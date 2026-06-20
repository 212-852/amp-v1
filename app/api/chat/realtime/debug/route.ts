import { sendAuthDebug } from "@/core/debug"

const realtime_events = new Set([
  "chat_realtime_subscribe_start",
  "chat_realtime_subscription_details",
  "chat_realtime_subscribed",
  "chat_realtime_raw_event_received",
  "chat_realtime_insert_received",
  "chat_realtime_filter_pass",
  "chat_realtime_payload_rejected",
  "chat_realtime_insert_append_done",
  "chat_realtime_insert_duplicate_skipped",
  "chat_realtime_insert_room_mismatch",
  "chat_realtime_render_done",
  "chat_optimistic_append_done",
  "chat_realtime_channel_error",
  "user_chat_realtime_subscribe_creating",
  "user_chat_realtime_subscribed",
  "user_chat_room_resolve_start",
  "user_chat_room_resolve_success",
  "user_chat_room_resolve_failed",
  "user_chat_initial_fetch_start",
  "user_chat_initial_fetch_success",
  "user_chat_initial_fetch_error",
  "user_chat_client_state_set",
  "user_chat_messages_state_set",
  "user_chat_render_state",
  "user_chat_timeout_cancelled",
  "user_chat_resolve_ignored_stale_request",
  "chat_input_cleared",
  "chat_send_started",
  "chat_send_success",
  "chat_send_failed",
  "chat_scroll_called",
  "chat_scroll_done",
])

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    event?: string
    payload?: Record<string, unknown>
  }
  const event = typeof body.event === "string" ? body.event : ""

  if (!realtime_events.has(event)) {
    return Response.json({ ok: false }, { status: 400 })
  }

  await sendAuthDebug(event, body.payload ?? {}, null)

  return Response.json({ ok: true })
}
