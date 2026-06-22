import "server-only"

import type { ChatMessageNotifyInput } from "@/core/notify/types"

export async function dispatchIncomingChatNotification(input: {
  room_uuid: string
  message_uuid: string
  sender_uuid: string | null
  sender_role: string
  user_name: string
  source_channel?: string | null
}) {
  const { sendNotifyDebug } = await import("@/core/notify/debug")

  await sendNotifyDebug("notification_trigger_created", {
    message_uuid: input.message_uuid,
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid,
    sender_role: input.sender_role,
    receiver_uuid: null,
    receiver_role: "concierge",
    source_channel: input.source_channel ?? null,
    request_id: input.message_uuid,
  })

  const notify_input: ChatMessageNotifyInput = {
    room_uuid: input.room_uuid,
    message_uuid: input.message_uuid,
    sender_uuid: input.sender_uuid,
    sender_role: input.sender_role,
    receiver_role: "concierge",
    user_name: input.user_name,
    source_channel: input.source_channel ?? null,
    request_id: input.message_uuid,
  }

  const { notifyChatMessageReceived } = await import("@/core/notify")

  return notifyChatMessageReceived(notify_input)
}
