import { sendNotifyDebug } from "@/core/notify/debug"
import type { ChatNotificationPayload } from "@/core/notify/types"

export async function deliverChatLineNotification(
  input: ChatNotificationPayload & {
    line_user_id: string
    request_id?: string | null
  },
) {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim()

  if (!token || !input.line_user_id) {
    return { delivered: false, reason: "missing_line_destination" }
  }

  await sendNotifyDebug("notify_line_send_started", {
    room_uuid: input.room_uuid,
    receiver_uuid: input.receiver_user_uuid,
    contact_uuid: input.contact_uuid ?? null,
    selected_channel: "line",
    receive: input.contact_receive ?? null,
    state: input.contact_state ?? null,
    channel: input.contact_channel ?? null,
    line_user_id: input.line_user_id,
    request_id: input.request_id ?? null,
  })

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.line_user_id,
      messages: [
        {
          type: "text",
          text: `${input.title}\n\n${input.body}\n\n${input.room_url}`,
        },
      ],
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    return { delivered: false, reason: "line_push_failed" }
  }

  await sendNotifyDebug("notify_line_send_success", {
    room_uuid: input.room_uuid,
    receiver_uuid: input.receiver_user_uuid,
    contact_uuid: input.contact_uuid ?? null,
    selected_channel: "line",
    receive: input.contact_receive ?? null,
    state: input.contact_state ?? null,
    channel: input.contact_channel ?? null,
    line_user_id: input.line_user_id,
    request_id: input.request_id ?? null,
  })

  return { delivered: true }
}
