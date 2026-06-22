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
  type ChatNotifySenderRole,
} from "@/core/notify/chat_rules"
import { deliverChatNotifyOutput } from "@/core/notify/output"
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
    if (route.delivery === "none") {
      await sendNotifyDebug("notify_flow_skipped", {
        room_uuid: input.room_uuid,
        sender_uuid: input.sender_uuid ?? null,
        receiver_uuid: route.receiver_user_uuid,
        in_room: route.in_room,
        contact_state: route.contact_state,
        reason: resolveSkipReason({ route_reason: route.skipped_reason }),
        request_id,
      })
      continue
    }

    const decision = resolveChatNotifyDecision({
      availability: "on",
      sender_role,
      delivery: route.delivery,
    })

    if (!decision.should_deliver) {
      await sendNotifyDebug("notify_flow_skipped", {
        room_uuid: input.room_uuid,
        sender_uuid: input.sender_uuid ?? null,
        receiver_uuid: route.receiver_user_uuid,
        delivery: route.delivery,
        reason: resolveSkipReason({
          route_reason: route.skipped_reason,
          decision_reason: decision.skip_reason,
        }),
        request_id,
      })
      continue
    }

    const payload = {
      ...content,
      receiver_user_uuid: route.receiver_user_uuid,
      contact_uuid: route.selected_contact?.contact_uuid ?? null,
      selected_channel:
        route.delivery === "in_app_toast"
          ? null
          : (route.selected_contact?.contact_type ?? null),
      contact_receive: route.selected_contact?.receive ?? null,
      contact_state: route.contact_state,
      contact_channel: route.selected_contact?.channel ?? null,
      request_id,
    }

    if (route.delivery === "in_app_toast") {
      const result = await deliverChatNotifyOutput({
        ...payload,
        delivery: "in_app_toast",
      })

      if (result.delivered) {
        delivered_count += 1
      }

      continue
    }

    if (route.delivery === "push") {
      const result = await deliverChatNotifyOutput({
        ...payload,
        delivery: "push",
        push_subscription: route.selected_contact?.push_subscription ?? null,
      })

      if (result.delivered) {
        delivered_count += 1
        continue
      }

      if (route.line_user_id) {
        await sendNotifyDebug("notify_line_fallback_used", {
          room_uuid: input.room_uuid,
          sender_uuid: input.sender_uuid ?? null,
          receiver_uuid: route.receiver_user_uuid,
          contact_uuid: route.selected_contact?.contact_uuid ?? null,
          selected_channel: "line",
          reason: "push_failed",
          request_id,
        })

        const line_result = await deliverChatNotifyOutput({
          ...payload,
          delivery: "line",
          line_user_id: route.line_user_id,
        })

        if (line_result.delivered) {
          delivered_count += 1
        }
      }

      continue
    }

    if (route.delivery === "line") {
      const result = await deliverChatNotifyOutput({
        ...payload,
        delivery: "line",
        line_user_id: route.line_user_id,
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
