import { NextResponse, type NextRequest } from "next/server"

import { sendAuthDebug } from "@/core/debug"

const allowed_auth_client_debug_events = new Set([
  "logout_clicked",
  "logout_toast_loading_shown",
  "logout_toast_success_shown",
  "logout_redirect_started",
  "logout_request_failed",
])

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  const event = typeof body.event === "string" ? body.event : null

  if (!event || !allowed_auth_client_debug_events.has(event)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  await sendAuthDebug(event, body)

  return NextResponse.json({ ok: true })
}
