import "server-only"

import { sendNotifyDebug } from "@/core/notify/debug"
import type { ChatNotificationPayload } from "@/core/notify/types"
import webpush from "web-push"

function resolveVapidConfig() {
  const public_key =
    process.env.VAPID_PUBLIC_KEY?.trim() ??
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ??
    ""
  const private_key = process.env.VAPID_PRIVATE_KEY?.trim() ?? ""
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:noreply@da-nya.com"

  if (!public_key || !private_key) {
    return null
  }

  return { public_key, private_key, subject }
}

export async function send_push_notification(
  input: ChatNotificationPayload & {
    push_subscription: {
      endpoint: string
      keys?: {
        p256dh?: string | null
        auth?: string | null
      }
    }
    request_id?: string | null
  },
) {
  if (!input.push_subscription.endpoint) {
    await sendNotifyDebug("notify_push_send_failed", {
      room_uuid: input.room_uuid,
      receiver_uuid: input.receiver_user_uuid,
      contact_uuid: input.contact_uuid ?? null,
      selected_channel: "push",
      receive: input.contact_receive ?? null,
      state: input.contact_state ?? null,
      channel: input.contact_channel ?? null,
      reason: "missing_push_endpoint",
      notification_result: "failed",
      request_id: input.request_id ?? null,
    })
    return { delivered: false, reason: "missing_push_endpoint" }
  }

  await sendNotifyDebug("notify_push_send_started", {
    room_uuid: input.room_uuid,
    receiver_uuid: input.receiver_user_uuid,
    contact_uuid: input.contact_uuid ?? null,
    selected_channel: "push",
    receive: input.contact_receive ?? null,
    state: input.contact_state ?? null,
    channel: input.contact_channel ?? null,
    notification_result: "started",
    request_id: input.request_id ?? null,
  })

  try {
    const vapid = resolveVapidConfig()

    if (!vapid) {
      await sendNotifyDebug("notify_push_send_failed", {
        room_uuid: input.room_uuid,
        receiver_uuid: input.receiver_user_uuid,
        contact_uuid: input.contact_uuid ?? null,
        selected_channel: "push",
        receive: input.contact_receive ?? null,
        state: input.contact_state ?? null,
        channel: input.contact_channel ?? null,
        reason: "missing_vapid_config",
        notification_result: "failed",
        request_id: input.request_id ?? null,
      })

      return { delivered: false, reason: "missing_vapid_config" }
    }

    const p256dh = input.push_subscription.keys?.p256dh?.trim()
    const auth = input.push_subscription.keys?.auth?.trim()

    if (!p256dh || !auth) {
      await sendNotifyDebug("notify_push_send_failed", {
        room_uuid: input.room_uuid,
        receiver_uuid: input.receiver_user_uuid,
        contact_uuid: input.contact_uuid ?? null,
        selected_channel: "push",
        receive: input.contact_receive ?? null,
        state: input.contact_state ?? null,
        channel: input.contact_channel ?? null,
        reason: "missing_push_keys",
        notification_result: "failed",
        request_id: input.request_id ?? null,
      })

      return { delivered: false, reason: "missing_push_keys" }
    }

    webpush.setVapidDetails(vapid.subject, vapid.public_key, vapid.private_key)

    await webpush.sendNotification({
      endpoint: input.push_subscription.endpoint,
      keys: {
        p256dh,
        auth,
      },
    }, JSON.stringify({
      title: input.title,
      body: input.body,
      data: {
        room_uuid: input.room_uuid,
        room_url: input.room_url,
      },
    }), { TTL: 86400 })

    await sendNotifyDebug("notify_push_send_success", {
      room_uuid: input.room_uuid,
      receiver_uuid: input.receiver_user_uuid,
      contact_uuid: input.contact_uuid ?? null,
      selected_channel: "push",
      receive: input.contact_receive ?? null,
      state: input.contact_state ?? null,
      channel: input.contact_channel ?? null,
      notification_result: "success",
      request_id: input.request_id ?? null,
    })

    return { delivered: true }
  } catch (error) {
    await sendNotifyDebug("notify_push_send_failed", {
      room_uuid: input.room_uuid,
      receiver_uuid: input.receiver_user_uuid,
      contact_uuid: input.contact_uuid ?? null,
      selected_channel: "push",
      receive: input.contact_receive ?? null,
      state: input.contact_state ?? null,
      channel: input.contact_channel ?? null,
      reason: error instanceof Error ? error.message : String(error),
      status:
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
          ? error.statusCode
          : null,
      notification_result: "failed",
      request_id: input.request_id ?? null,
    })

    return {
      delivered: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}
