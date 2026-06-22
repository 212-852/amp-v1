import "server-only"

import { create_service_role_supabase_client } from "@/core/auth/supabase"
import { sendNotifyDebug } from "@/core/notify/debug"
import { deliverChatLineNotification } from "@/core/notify/line"
import { CHAT_IN_APP_TOAST_MESSAGE } from "@/core/notify/messages"
import { send_push_notification } from "@/core/notify/push"
import type { ChatNotificationPayload } from "@/core/notify/types"

export { CHAT_IN_APP_TOAST_MESSAGE } from "@/core/notify/messages"

export type ChatNotifyOutputInput = ChatNotificationPayload & {
  delivery: "in_app_toast" | "push" | "line"
  push_subscription?: {
    endpoint: string
    keys?: {
      p256dh?: string | null
      auth?: string | null
    }
  } | null
  line_user_id?: string | null
  request_id?: string | null
}

function notifyUserChannelName(user_uuid: string) {
  return `notify:${user_uuid}`
}

export async function deliverChatNotifyOutput(input: ChatNotifyOutputInput) {
  if (input.delivery === "in_app_toast") {
    await sendNotifyDebug("notify_in_app_toast_started", {
      room_uuid: input.room_uuid,
      receiver_uuid: input.receiver_user_uuid,
      request_id: input.request_id ?? null,
    })

    const supabase = create_service_role_supabase_client()
    const channel = supabase.channel(notifyUserChannelName(input.receiver_user_uuid), {
      config: {
        broadcast: {
          ack: false,
          self: false,
        },
      },
    })

    const delivered = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        void supabase.removeChannel(channel)
        resolve(false)
      }, 3000)

      channel.subscribe((status) => {
        if (status !== "SUBSCRIBED") {
          return
        }

        void channel
          .send({
            type: "broadcast",
            event: "notify_toast",
            payload: {
              room_uuid: input.room_uuid,
              message: CHAT_IN_APP_TOAST_MESSAGE,
              request_id: input.request_id ?? null,
            },
          })
          .then(() => {
            clearTimeout(timeout)
            void supabase.removeChannel(channel)
            resolve(true)
          })
          .catch(() => {
            clearTimeout(timeout)
            void supabase.removeChannel(channel)
            resolve(false)
          })
      })
    })

    await sendNotifyDebug("notify_in_app_toast_sent", {
      room_uuid: input.room_uuid,
      receiver_uuid: input.receiver_user_uuid,
      delivered,
      request_id: input.request_id ?? null,
    })

    return { delivered, reason: delivered ? undefined : "toast_broadcast_failed" }
  }

  if (input.delivery === "line") {
    if (!input.line_user_id) {
      return { delivered: false, reason: "missing_line_destination" }
    }

    return deliverChatLineNotification({
      ...input,
      line_user_id: input.line_user_id,
    })
  }

  if (input.delivery === "push") {
    if (!input.push_subscription?.endpoint) {
      return { delivered: false, reason: "missing_push_subscription" }
    }

    return send_push_notification({
      ...input,
      push_subscription: input.push_subscription,
    })
  }

  return { delivered: false, reason: "unsupported_delivery" }
}
