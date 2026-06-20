import { sendNotifyDebug } from "@/core/notify/debug"
import type { ChatNotificationPayload } from "@/core/notify/types"

export async function deliverChatLineNotification(
  input: ChatNotificationPayload & {
    line_user_id: string
  },
) {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim()

  if (!token || !input.line_user_id) {
    await sendNotifyDebug("notification_failed", {
      channel: "line",
      room_uuid: input.room_uuid,
      receiver_user_uuid: input.receiver_user_uuid,
      reason: "missing_line_destination",
    })
    return { delivered: false, reason: "missing_line_destination" }
  }

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
    const error_message = await response.text().catch(() => "")

    await sendNotifyDebug("notification_failed", {
      channel: "line",
      room_uuid: input.room_uuid,
      receiver_user_uuid: input.receiver_user_uuid,
      reason: "line_push_failed",
      error_message,
      status: response.status,
    })

    return { delivered: false, reason: "line_push_failed" }
  }

  await sendNotifyDebug("notification_sent_line", {
    room_uuid: input.room_uuid,
    receiver_user_uuid: input.receiver_user_uuid,
    line_user_id: input.line_user_id,
  })

  return { delivered: true }
}
