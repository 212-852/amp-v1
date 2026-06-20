"use client"

type ChatRealtimeDebugEvent =
  | "chat_realtime_hook_mounted"
  | "chat_realtime_subscribe_creating"
  | "chat_realtime_subscribed"
  | "chat_realtime_insert_received"
  | "chat_realtime_room_mismatch"
  | "chat_realtime_duplicate_skipped"
  | "chat_realtime_append_done"
  | "chat_realtime_channel_error"

export type ChatRealtimeDebugPayload = {
  view?: "user" | "concierge"
  room_uuid?: string | null
  incoming_room_uuid?: string | null
  message_uuid?: string | null
  client_message_id?: string | null
  sender_uuid?: string | null
  current_user_uuid?: string | null
  reason?: string | null
  [key: string]: unknown
}

export function send_chat_realtime_debug(
  event: ChatRealtimeDebugEvent,
  payload: ChatRealtimeDebugPayload,
) {
  void fetch("/api/chat/realtime/debug", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ event, payload }),
    keepalive: true,
  }).catch(() => null)
}
