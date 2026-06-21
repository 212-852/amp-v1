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

function resolveSkipReason(input: {
  route_reason?: string | null
  decision_reason?: string | null
}) {
  const reason = input.route_reason ?? input.decision_reason ?? "unknown"

  if (reason === "missing_contact") {
    return "no_contact"
  }

  return reason
}

export async function notifyChatMessageReceived(input: ChatMessageNotifyInput) {
  const request_id =
    input.request_id ?? `chat_notify:${input.room_uuid}:${Date.now()}`

  await sendNotifyDebug("notify_flow_started", {
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid ?? null,
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
    request_id,
  })

  if (routes.length === 0) {
    await sendNotifyDebug("notify_flow_skipped", {
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      reason: "no_receiver",
      request_id,
    })

    return { delivered_count }
  }

  for (const route of routes) {
    const decision = resolveChatNotifyDecision({
      availability: "on",
      sender_role,
      receiver_role,
      receiver_active: route.receiver_active,
      contact_type: route.selected_contact?.contact_type ?? null,
    })

    if (!decision.should_notify) {
      await sendNotifyDebug("notify_flow_skipped", {
        room_uuid: input.room_uuid,
        sender_uuid: input.sender_uuid ?? null,
        receiver_uuid: route.receiver_user_uuid,
        contact_uuid: route.selected_contact?.contact_uuid ?? null,
        contact_type: route.selected_contact?.contact_type ?? null,
        reason: resolveSkipReason({
          route_reason: route.skipped_reason,
          decision_reason: decision.skip_reason,
        }),
        request_id,
      })
      continue
    }

    const selected_contact = route.selected_contact

    if (!selected_contact) {
      await sendNotifyDebug("notify_flow_skipped", {
        room_uuid: input.room_uuid,
        sender_uuid: input.sender_uuid ?? null,
        receiver_uuid: route.receiver_user_uuid,
        reason: "no_contact",
        request_id,
      })
      continue
    }

    const payload = {
      ...content,
      receiver_user_uuid: route.receiver_user_uuid,
      contact_uuid: selected_contact.contact_uuid,
      selected_channel: selected_contact.contact_type,
      contact_receive: selected_contact.receive,
      contact_state: selected_contact.state,
      contact_channel: selected_contact.channel,
      request_id,
    }

    if (selected_contact.contact_type === "line") {
      await sendNotifyDebug("notify_line_fallback_used", {
        room_uuid: input.room_uuid,
        sender_uuid: input.sender_uuid ?? null,
        receiver_uuid: route.receiver_user_uuid,
        contact_uuid: selected_contact.contact_uuid,
        selected_channel: "line",
        reason: "no_valid_push_contact",
        request_id,
      })

      const result = await deliverChatLineNotification({
        ...payload,
        line_user_id: selected_contact.contact_value,
      })

      if (result.delivered) {
        delivered_count += 1
      }

      continue
    }

    if (selected_contact.contact_type === "push") {
      const { send_push_notification } = await import("./push")
      const result = await send_push_notification({
        ...payload,
        push_subscription: selected_contact.push_subscription ?? {
          endpoint: selected_contact.contact_value,
        },
      })

      if (result.delivered) {
        delivered_count += 1
      }
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
