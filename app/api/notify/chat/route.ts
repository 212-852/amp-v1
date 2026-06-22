import { NextResponse } from "next/server"

import { notifyChatMessageReceived } from "@/core/notify/chat_flow"
import type { ChatMessageNotifyInput } from "@/core/notify/types"

export const runtime = "nodejs"

function isInternalNotifyRequest(request: Request) {
  const secret = process.env.OTP_SECRET?.trim()

  if (!secret) {
    return false
  }

  return request.headers.get("x-amp-internal-notify") === secret
}

export async function POST(request: Request) {
  if (!isInternalNotifyRequest(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    )
  }

  const input = (await request.json().catch(() => null)) as
    | ChatMessageNotifyInput
    | null

  if (!input?.room_uuid || !input.sender_role || !input.user_name) {
    return NextResponse.json(
      { ok: false, error: "invalid_notify_payload" },
      { status: 400 },
    )
  }

  const result = await notifyChatMessageReceived(input)

  return NextResponse.json(result)
}
