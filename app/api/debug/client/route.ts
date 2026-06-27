import { NextResponse } from "next/server"

import { sendAuthDebug } from "@/core/debug"
import { resolveRequestIdFromHeaders } from "@/core/auth/session"

const ALLOWED_CLIENT_DEBUG_EVENTS = new Set([
  "liff_client_checked",
  "OCR_CAMERA_START_REQUESTED",
  "OCR_CAMERA_START_SKIPPED",
  "OCR_CAMERA_PERMISSION_REQUESTED",
  "OCR_CAMERA_PERMISSION_DENIED",
  "OCR_CAMERA_STREAM_RECEIVED",
  "OCR_VIDEO_METADATA_LOADED",
  "OCR_VIDEO_CAN_PLAY",
  "OCR_CAMERA_PLAYING",
  "OCR_CAMERA_STOP",
  "OCR_CAMERA_START_FAILED",
  "OCR_IMAGE_SELECTED",
  "OCR_READ_STARTED",
  "OCR_READ_SUCCEEDED",
  "OCR_READ_FAILED",
  "OCR_FORM_FILLED",
])

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >
  const event =
    typeof body.event === "string" ? body.event.trim() : "client_debug"

  if (!ALLOWED_CLIENT_DEBUG_EVENTS.has(event)) {
    return NextResponse.json({ ok: false, error: "unsupported_event" }, { status: 400 })
  }

  const request_id =
    typeof body.request_id === "string"
      ? body.request_id
      : await resolveRequestIdFromHeaders()

  const payload = { ...body }
  delete payload.event

  await sendAuthDebug(event, payload, request_id)

  return NextResponse.json({ ok: true })
}
