import "server-only"

import type { ChatMessageNotifyInput } from "@/core/notify/types"

export async function dispatchIncomingChatNotification(input: {
  room_uuid: string
  message_uuid: string
  sender_uuid: string | null
  sender_participant_uuid: string
  sender_role: string
  user_name: string
  message_body: string
  message_type: string
  message_source?: string | null
  source_channel?: string | null
}) {
  const { sendNotifyDebug } = await import("@/core/notify/debug")

  await sendNotifyDebug("notification_trigger_created", {
    message_uuid: input.message_uuid,
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid,
    sender_role: input.sender_role,
    receiver_uuid: null,
    source_channel: input.source_channel ?? null,
    request_id: input.message_uuid,
  })

  const notify_input: ChatMessageNotifyInput = {
    room_uuid: input.room_uuid,
    message_uuid: input.message_uuid,
    sender_uuid: input.sender_uuid,
    sender_participant_uuid: input.sender_participant_uuid,
    sender_role: input.sender_role,
    user_name: input.user_name,
    message_body: input.message_body,
    message_type: input.message_type,
    message_source: input.message_source ?? null,
    source_channel: input.source_channel ?? null,
    request_id: input.message_uuid,
  }

  const { notifyChatMessageReceived } = await import("@/core/notify")

  return notifyChatMessageReceived(notify_input)
}
