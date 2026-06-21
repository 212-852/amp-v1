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
  resolveChatNotifyRoutes,
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

export async function notifyChatMessageReceived(input: ChatMessageNotifyInput) {
  const request_id =
    input.request_id ?? `chat_notify:${input.room_uuid}:${Date.now()}`

  await sendNotifyDebug("notification_requested", {
    room_uuid: input.room_uuid,
    sender_role: input.sender_role,
    receiver_role: input.receiver_role ?? "concierge",
    request_id,
  })

  const content = buildChatNotificationContent({
    user_name: input.user_name,
    room_uuid: input.room_uuid,
  })
  const sender_role = input.sender_role as ChatNotifySenderRole
  const receiver_role = (input.receiver_role ?? "concierge") as ChatNotifyReceiverRole

  let delivered_count = 0
  const routes = await resolveChatNotifyRoutes({
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid ?? null,
    sender_role,
  })

  await sendNotifyDebug("notify_receiver_resolved", {
    room_uuid: input.room_uuid,
    receiver_count: routes.length,
    receiver_user_uuids: routes.map((route) => route.receiver_user_uuid),
    request_id,
  })

  for (const route of routes) {
    const decision = resolveChatNotifyDecision({
      availability: "on",
      sender_role,
      receiver_role,
      receiver_active: route.receiver_active,
      contact_type: route.contact_type,
    })

    await sendNotifyDebug("notify_route_decided", {
      room_uuid: input.room_uuid,
      receiver_user_uuid: route.receiver_user_uuid,
      contact_type: route.contact_type,
      receiver_active: route.receiver_active,
      skipped_reason: route.skipped_reason ?? decision.skip_reason,
      request_id,
    })

    if (route.push_preferred) {
      await sendNotifyDebug("notify_push_preferred", {
        room_uuid: input.room_uuid,
        receiver_user_uuid: route.receiver_user_uuid,
        contact_type: route.contact_type,
        skipped_reason: route.skipped_reason ?? null,
        request_id,
      })
    }

    if (!decision.should_notify) {
      const debug_event =
        decision.skip_reason === "availability_off"
          ? "notification_skipped_availability_off"
          : decision.skip_reason === "receiver_active"
            ? "notification_skipped_receiver_active"
            : decision.skip_reason === "missing_contact"
              ? "notification_skipped_missing_contact"
              : "notification_skipped_invalid_sender"

      await sendNotifyDebug(debug_event, {
        room_uuid: input.room_uuid,
        receiver_user_uuid: route.receiver_user_uuid,
        sender_role,
        receiver_role,
        reason: route.skipped_reason ?? decision.skip_reason,
        request_id,
      })
      if (route.skipped_reason === "push_not_sendable_no_line_fallback") {
        await sendNotifyDebug("notify_line_skipped_push_preferred", {
          room_uuid: input.room_uuid,
          receiver_user_uuid: route.receiver_user_uuid,
          reason: route.skipped_reason,
          request_id,
        })
      }
      continue
    }

    const payload = {
      ...content,
      receiver_user_uuid: route.receiver_user_uuid,
    }

    await sendNotifyDebug("notify_contact_selected", {
      room_uuid: input.room_uuid,
      receiver_user_uuid: route.receiver_user_uuid,
      contact_type: route.contact_type,
      request_id,
    })

    if (route.contact_type === "line" && route.contact_value) {
      await sendNotifyDebug("notify_line_send_started", {
        room_uuid: input.room_uuid,
        receiver_user_uuid: route.receiver_user_uuid,
        request_id,
      })
      const result = await deliverChatLineNotification({
        ...payload,
        line_user_id: route.contact_value,
      })

      if (result.delivered) {
        delivered_count += 1
      }

      continue
    }

    if (route.contact_type === "line") {
      await sendNotifyDebug("notify_line_skipped_reason", {
        room_uuid: input.room_uuid,
        receiver_user_uuid: route.receiver_user_uuid,
        reason: "missing_line_contact_value",
        request_id,
      })
      continue
    }

    if (!route.contact_value) {
      continue
    }

    await sendNotifyDebug("notify_line_skipped_reason", {
      room_uuid: input.room_uuid,
      receiver_user_uuid: route.receiver_user_uuid,
      reason: "push_contact_selected",
      request_id,
    })
    await sendNotifyDebug("notify_line_skipped_push_preferred", {
      room_uuid: input.room_uuid,
      receiver_user_uuid: route.receiver_user_uuid,
      reason: "push_contact_selected",
      request_id,
    })
    await sendNotifyDebug("notify_push_send_started", {
      room_uuid: input.room_uuid,
      receiver_user_uuid: route.receiver_user_uuid,
      request_id,
    })
    const result = await deliverChatPushNotification({
      ...payload,
      push_endpoint: route.contact_value,
    })

    if (result.delivered) {
      await sendNotifyDebug("notify_push_send_success", {
        room_uuid: input.room_uuid,
        receiver_user_uuid: route.receiver_user_uuid,
        request_id,
      })
      delivered_count += 1
    } else {
      await sendNotifyDebug("notify_push_send_failed", {
        room_uuid: input.room_uuid,
        receiver_user_uuid: route.receiver_user_uuid,
        reason: result.reason ?? "push_send_failed",
        request_id,
      })
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
