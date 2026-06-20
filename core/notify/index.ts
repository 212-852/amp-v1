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
import {
  buildChatNotificationContent,
  resolveChatNotifyDecision,
  type ChatNotifyReceiverRole,
  type ChatNotifySenderRole,
} from "@/core/notify/chat_rules"
import { deliverChatLineNotification } from "@/core/notify/line"
import { deliverChatPushNotification } from "@/core/notify/push"
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

async function logNotifyDebug(
  event: string,
  payload: Record<string, unknown>,
) {
  await sendNotifyDebug(event, payload, payload.request_id as string | null)
}

async function loadAdminContactDestination(input: {
  user_uuid: string
  notification_type: "line" | "push"
}) {
  const { getRestConfig, restHeaders, restUrl } = await import("@/core/db/rest")
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const filter = [
    `user_uuid=eq.${encodeURIComponent(input.user_uuid)}`,
    `type=eq.${encodeURIComponent(input.notification_type)}`,
    "select=value",
    "limit=1",
  ].join("&")

  const response = await fetch(restUrl(config, "contacts", filter), {
    headers: restHeaders(config),
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as Array<{ value?: string | null }>
  const value = rows[0]?.value?.trim()

  return value || null
}

export async function notifyChatMessageReceived(input: ChatMessageNotifyInput) {
  const request_id =
    input.request_id ?? `chat_notify:${input.room_uuid}:${Date.now()}`

  await sendNotifyDebug("notification_requested", {
    room_uuid: input.room_uuid,
    sender_role: input.sender_role,
    receiver_role: input.receiver_role ?? "concierge",
    request_id,
  })

  const {
    loadEnabledAvailabilityRecipients,
  } = await import("@/core/chat/archive")

  const recipients = await loadEnabledAvailabilityRecipients()
  const { load_profile_notification_type } = await import("@/core/profile/action")
  const content = buildChatNotificationContent({
    user_name: input.user_name,
    room_uuid: input.room_uuid,
  })

  const sender_role = input.sender_role as ChatNotifySenderRole
  const receiver_role = (input.receiver_role ?? "concierge") as ChatNotifyReceiverRole

  let delivered_count = 0

  for (const recipient of recipients) {
    const notification_type = await load_profile_notification_type(
      recipient.user_uuid,
    )
    const decision = resolveChatNotifyDecision({
      availability: "on",
      notification_type,
      sender_role,
      receiver_role,
    })

    if (!decision.should_notify) {
      const debug_event =
        decision.skip_reason === "availability_off"
          ? "notification_skipped_availability_off"
          : "notification_skipped_invalid_sender"

      await sendNotifyDebug(debug_event, {
        room_uuid: input.room_uuid,
        receiver_user_uuid: recipient.user_uuid,
        sender_role,
        receiver_role,
        request_id,
      })
      continue
    }

    const payload = {
      ...content,
      receiver_user_uuid: recipient.user_uuid,
    }

    if (notification_type === "line") {
      const line_user_id = await loadAdminContactDestination({
        user_uuid: recipient.user_uuid,
        notification_type: "line",
      })

      if (!line_user_id) {
        await sendNotifyDebug("notification_failed", {
          room_uuid: input.room_uuid,
          receiver_user_uuid: recipient.user_uuid,
          reason: "missing_line_contact",
          request_id,
        })
        continue
      }

      const result = await deliverChatLineNotification({
        ...payload,
        line_user_id,
      })

      if (result.delivered) {
        delivered_count += 1
      }

      continue
    }

    const push_endpoint = await loadAdminContactDestination({
      user_uuid: recipient.user_uuid,
      notification_type: "push",
    })

    if (!push_endpoint) {
      await sendNotifyDebug("notification_failed", {
        room_uuid: input.room_uuid,
        receiver_user_uuid: recipient.user_uuid,
        reason: "missing_push_contact",
        request_id,
      })
      continue
    }

    const result = await deliverChatPushNotification({
      ...payload,
      push_endpoint,
    })

    if (result.delivered) {
      delivered_count += 1
    }
  }

  return { delivered_count }
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
