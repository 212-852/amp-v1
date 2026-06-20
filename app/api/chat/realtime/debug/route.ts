import { sendAuthDebug } from "@/core/debug"

const realtime_events = new Set([
  "chat_realtime_hook_mounted",
  "chat_realtime_subscribe_creating",
  "chat_realtime_subscribed",
  "chat_realtime_insert_received",
  "chat_realtime_room_mismatch",
  "chat_realtime_duplicate_skipped",
  "chat_realtime_append_done",
  "chat_realtime_channel_error",
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
