"use client"

type ChatRealtimeDebugEvent =
  | "chat_realtime_subscribe_start"
  | "chat_realtime_subscription_details"
  | "chat_realtime_subscribed"
  | "chat_realtime_raw_event_received"
  | "chat_realtime_insert_received"
  | "chat_realtime_filter_pass"
  | "chat_realtime_payload_rejected"
  | "chat_realtime_insert_append_done"
  | "chat_realtime_insert_duplicate_skipped"
  | "chat_realtime_insert_room_mismatch"
  | "chat_realtime_render_done"
  | "chat_optimistic_append_done"
  | "chat_realtime_channel_error"
  | "user_chat_realtime_subscribe_creating"
  | "user_chat_realtime_subscribed"
  | "user_chat_room_resolve_failed"
  | "user_chat_client_state_set"
  | "user_chat_messages_state_set"
  | "user_chat_render_state"
  | "user_chat_timeout_cancelled"
  | "user_chat_resolve_ignored_stale_request"
  | "chat_input_cleared"
  | "chat_send_started"
  | "chat_send_success"
  | "chat_send_failed"
  | "chat_scroll_called"
  | "chat_scroll_done"

export type ChatRealtimeDebugPayload = {
  view?: "user" | "concierge"
  receiver_view?: "user" | "concierge"
  room_uuid?: string | null
  incoming_room_uuid?: string | null
  message_uuid?: string | null
  client_message_id?: string | null
  sender_uuid?: string | null
  current_user_uuid?: string | null
  visitor_uuid?: string | null
  rendered_count?: number
  reason?: string | null
  eventType?: string | null
  channel_name?: string | null
  schema?: string | null
  table?: string | null
  event?: string | null
  filter?: string | null
  filter_mode?: string | null
  payload_new?: unknown
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
