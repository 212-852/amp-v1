import "server-only"

import { sendNotifyDebug } from "@/core/notify/debug"
import {
  buildChatNotificationContent,
  resolveChatNotifyDecision,
  type ChatNotifySenderRole,
} from "@/core/notify/chat_rules"
import { deliverChatNotifyOutput } from "@/core/notify/output"
import { resolveChatNotifyRoutes } from "@/core/notify/rules"
import type { ChatMessageNotifyInput } from "@/core/notify/types"

function resolveSkipReason(input: {
  route_reason?: string | null
  decision_reason?: string | null
}) {
  const reason = input.route_reason ?? input.decision_reason ?? "unknown"

  return reason
}

export async function notifyChatMessageReceived(input: ChatMessageNotifyInput) {
  const request_id =
    input.request_id ?? `chat_notify:${input.room_uuid}:${Date.now()}`

  await sendNotifyDebug("notification_rule_started", {
    message_uuid: input.message_uuid ?? input.request_id ?? null,
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid ?? null,
    sender_role: input.sender_role,
    receiver_uuid: null,
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
    message_uuid: input.message_uuid ?? null,
    message_text: content.body,
    source_channel: input.source_channel ?? null,
    request_id,
  })

  if (routes.length === 0) {
    await sendNotifyDebug("notification_route_decided", {
      message_uuid: input.message_uuid ?? null,
      room_uuid: input.room_uuid,
      sender_uuid: input.sender_uuid ?? null,
      receiver_uuid: null,
      should_notify: false,
      delivery_channel: null,
      reason: "no_receiver",
      request_id,
    })

    return { delivered_count }
  }

  for (const route of routes) {
    if (route.delivery === "none") {
      await sendNotifyDebug("notification_route_decided", {
        message_uuid: input.message_uuid ?? null,
        room_uuid: input.room_uuid,
        sender_uuid: input.sender_uuid ?? null,
        receiver_uuid: route.receiver_user_uuid,
        should_notify: false,
        delivery_channel: null,
        is_in_room: route.in_room,
        presence_status: route.presence_status,
        left_at: route.left_at,
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
      await sendNotifyDebug("notification_route_decided", {
        message_uuid: input.message_uuid ?? null,
        room_uuid: input.room_uuid,
        sender_uuid: input.sender_uuid ?? null,
        receiver_uuid: route.receiver_user_uuid,
        should_notify: false,
        delivery_channel: route.delivery,
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
      selected_channel: route.selected_contact?.contact_type ?? null,
      contact_receive: route.selected_contact?.receive ?? null,
      contact_state: route.contact_state,
      contact_channel: route.selected_contact?.channel ?? null,
      request_id,
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
