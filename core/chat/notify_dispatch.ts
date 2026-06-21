import "server-only"

import type { ChatMessageNotifyInput } from "@/core/notify/types"

export async function dispatchIncomingChatNotification(input: {
  room_uuid: string
  message_uuid: string
  sender_uuid: string | null
  sender_role: string
  user_name: string
}) {
  if (input.sender_role !== "user" && input.sender_role !== "guest") {
    return { delivered_count: 0 }
  }

  const notify_input: ChatMessageNotifyInput = {
    room_uuid: input.room_uuid,
    sender_uuid: input.sender_uuid,
    sender_role: input.sender_role,
    receiver_role: "concierge",
    user_name: input.user_name,
    request_id: input.message_uuid,
  }

  const { notifyChatMessageReceived } = await import("@/core/notify")

  return notifyChatMessageReceived(notify_input)
}
