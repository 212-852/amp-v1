import {
  hasNotifyBeenDelivered,
  markNotifyDelivered,
} from "@/core/notify/dedup"
import {
  deliverDiscordNotification,
  notifyDiscord,
} from "@/core/notify/discord"
import {
  resolveNotifyDelivery,
  type NotifyEventInput,
} from "@/core/notify/rules"

export type NotifyMessage = {
  channel: "discord"
  title: string
  event: string
  request_id?: string | null
  payload: Record<string, unknown>
}

export type NotifyEventResult = {
  delivered: boolean
  reason?: string
  thread_id?: string | null
  thread_status?: "open" | "closed" | null
}

let odin_env_validated = false

async function logNotifyDebug(
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    const { sendAuthDebug } = await import("@/core/debug")
    await sendAuthDebug(event, payload, payload.request_id as string | null)
  } catch {
    // Server debug only. Never log Odin config to browser console.
  }
}

async function validateOdinEnvOnce() {
  if (odin_env_validated) {
    return
  }

  odin_env_validated = true

  const missing: string[] = []

  if (!process.env.ACTION_ODIN_BOT_TOKEN?.trim()) {
    missing.push("ACTION_ODIN_BOT_TOKEN")
  }

  if (!process.env.ACTION_ODIN_CHANNEL_ID?.trim()) {
    missing.push("ACTION_ODIN_CHANNEL_ID")
  }

  if (!process.env.ACTION_ODIN_WEBHOOK_URL?.trim()) {
    missing.push("ACTION_ODIN_WEBHOOK_URL")
  }

  if (!process.env.ACTION_ODIN_GUILD_ID?.trim()) {
    missing.push("ACTION_ODIN_GUILD_ID")
  }

  if (missing.length === 0) {
    return
  }

  await logNotifyDebug("notify_delivery_skipped", {
    reason: `${missing.join(", ")} missing`,
    channel: "odin",
    missing_env: missing,
  })
}

export async function notifyEvent(input: NotifyEventInput) {
  if (input.request_id && hasNotifyBeenDelivered(input.request_id, input.event)) {
    await logNotifyDebug("notify_delivery_skipped", {
      reason: "duplicate_request",
      event: input.event,
      request_id: input.request_id ?? null,
    })
    return { delivered: false, reason: "duplicate_request" } satisfies NotifyEventResult
  }

  const delivery = resolveNotifyDelivery(input)

  if (delivery.channel === "odin") {
    const room_uuid =
      typeof input.payload.room_uuid === "string"
        ? input.payload.room_uuid
        : null

    console.log({
      event: "odin_notify_entered",
      room_uuid,
      action: input.event,
    })
  }

  if (delivery.channel === "discord" && !delivery.webhook_url) {
    await logNotifyDebug("notify_delivery_skipped", {
      reason: "webhook_missing",
      event: input.event,
      request_id: input.request_id ?? null,
      webhook: "NOTIFY_WOLF_WEBHOOK",
      payload: input.payload,
    })
    return { delivered: false, reason: "webhook_missing" } satisfies NotifyEventResult
  }

  if (delivery.channel === "odin") {
    await validateOdinEnvOnce()

    const { resolveOdinSkipReason } = await import("@/core/notify/odin")
    const skip_reason = resolveOdinSkipReason()

    if (skip_reason) {
      await logNotifyDebug("notify_delivery_skipped", {
        reason: skip_reason,
        event: input.event,
        request_id: input.request_id ?? null,
        channel: "odin",
        payload: input.payload,
      })
      return { delivered: false, reason: skip_reason } satisfies NotifyEventResult
    }
  }

  if (input.request_id) {
    markNotifyDelivered(input.request_id, input.event)
  }

  try {
    let result: NotifyEventResult = { delivered: false }

    if (delivery.channel === "discord") {
      result = await deliverDiscordNotification(delivery)
    }

    if (delivery.channel === "odin") {
      const { deliverOdinNotification } = await import("@/core/notify/odin")
      result = await deliverOdinNotification(delivery)
    }

    await logNotifyDebug("notify_delivery_sent", {
      event: input.event,
      request_id: input.request_id ?? null,
      priority: delivery.priority,
      channel: delivery.channel,
      delivered: result.delivered,
      reason: result.reason ?? null,
      payload: input.payload,
    })

    return result
  } catch (error) {
    await logNotifyDebug("notify_delivery_failed", {
      event: input.event,
      request_id: input.request_id ?? null,
      error_message: error instanceof Error ? error.message : String(error),
      payload: input.payload,
    })

    return {
      delivered: false,
      reason: error instanceof Error ? error.message : String(error),
    } satisfies NotifyEventResult
  }
}

export async function notify(message: NotifyMessage) {
  if (message.channel === "discord") {
    await notifyDiscord(message)
  }
}

export type { NotifyEventInput, NotifyEventName } from "@/core/notify/rules"
