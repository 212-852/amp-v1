import {
  hasNotifyBeenDelivered,
  markNotifyDelivered,
} from "@/core/notify/dedup"
import { sendNotifyDebug } from "@/core/notify/debug"
import {
  deliverDiscordNotification,
  notifyDiscord,
} from "@/core/notify/discord"
import {
  resolveNotifyDelivery,
  type NotifyEventInput,
} from "@/core/notify/rules"
import type { ChatMessageNotifyInput } from "@/core/notify/types"

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
  http_status?: number | null
}

export async function notifyDebugMessage(input: NotifyMessage) {
  return notifyDiscord(input)
}

async function logNotifyDebug(
  event: string,
  payload: Record<string, unknown>,
) {
  await sendNotifyDebug(event, payload, payload.request_id as string | null)
}

async function resolveInternalNotifyUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()

  if (configured) {
    return `${configured.replace(/\/$/, "")}/api/notify/chat`
  }

  try {
    const { headers } = await import("next/headers")
    const request_headers = await headers()
    const host =
      request_headers.get("x-forwarded-host") ?? request_headers.get("host")
    const proto = request_headers.get("x-forwarded-proto") ?? "https"

    if (host) {
      return `${proto}://${host}/api/notify/chat`
    }
  } catch {
    // Headers are unavailable outside a request scope.
  }

  return null
}

export async function notifyChatMessageReceived(input: ChatMessageNotifyInput) {
  const url = await resolveInternalNotifyUrl()

  if (!url) {
    await sendNotifyDebug("notification_route_decided", {
      message_uuid: input.message_uuid ?? null,
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      receiver_uuid: null,
      should_notify: false,
      delivery_channel: null,
      reason: "internal_notify_url_missing",
      request_id: input.request_id ?? null,
    })

    return { delivered_count: 0 }
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-amp-internal-notify": process.env.OTP_SECRET?.trim() ?? "",
    },
    body: JSON.stringify(input),
    cache: "no-store",
  })

  if (!response.ok) {
    await sendNotifyDebug("notification_delivery_failed", {
      delivery_channel: "notify",
      receiver_uuid: null,
      error: `internal_notify_failed:${response.status}`,
      request_id: input.request_id ?? null,
    })

    return { delivered_count: 0 }
  }

  return (await response.json()) as { delivered_count: number }
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
