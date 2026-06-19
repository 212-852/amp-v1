import { sendAuthDebug } from "@/core/debug"
import { notifyEvent } from "@/core/notify"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function readOdinEnvStatus() {
  return {
    has_bot_token: Boolean(process.env.ACTION_ODIN_BOT_TOKEN?.trim()),
    has_guild_id: Boolean(process.env.ACTION_ODIN_GUILD_ID?.trim()),
    has_channel_id: Boolean(process.env.ACTION_ODIN_CHANNEL_ID?.trim()),
  }
}

export async function GET() {
  await sendAuthDebug("odin_smoke_entered", {
    route: "/api/debug/odin",
    ...readOdinEnvStatus(),
  })

  const result = await notifyEvent({
    event: "odin_smoke_test",
    request_id: `odin_smoke:${Date.now()}`,
    payload: {
      room_uuid: "odin_smoke_test",
      thread_status: "open",
    },
  })

  return Response.json({
    ok: result.delivered === true,
    thread_id: result.thread_id ?? null,
    http_status: result.http_status ?? null,
    error_message: result.delivered ? null : result.reason ?? "odin_smoke_failed",
  })
}
