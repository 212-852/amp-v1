import { sendNotifyDebug } from "@/core/notify/debug"
import type { ChatNotificationPayload } from "@/core/notify/types"

export async function deliverChatPushNotification(
  input: ChatNotificationPayload & {
    push_endpoint: string
  },
) {
  if (!input.push_endpoint) {
    await sendNotifyDebug("notification_failed", {
      channel: "push",
      room_uuid: input.room_uuid,
      receiver_user_uuid: input.receiver_user_uuid,
      reason: "missing_push_endpoint",
    })
    return { delivered: false, reason: "missing_push_endpoint" }
  }

  try {
    const response = await fetch(input.push_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        TTL: "86400",
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        data: {
          room_uuid: input.room_uuid,
          room_url: input.room_url,
        },
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      const error_message = await response.text().catch(() => "")

      await sendNotifyDebug("notification_failed", {
        channel: "push",
        room_uuid: input.room_uuid,
        receiver_user_uuid: input.receiver_user_uuid,
        reason: "push_delivery_failed",
        error_message,
        status: response.status,
      })

      return { delivered: false, reason: "push_delivery_failed" }
    }

    await sendNotifyDebug("notification_sent_push", {
      room_uuid: input.room_uuid,
      receiver_user_uuid: input.receiver_user_uuid,
    })

    return { delivered: true }
  } catch (error) {
    await sendNotifyDebug("notification_failed", {
      channel: "push",
      room_uuid: input.room_uuid,
      receiver_user_uuid: input.receiver_user_uuid,
      reason: error instanceof Error ? error.message : String(error),
    })

    return {
      delivered: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}
