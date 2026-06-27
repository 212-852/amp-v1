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
  "OCR_SCAN_STATE_CHANGED",
  "OCR_AUTO_CAPTURE_DISABLED_INITIAL_DELAY",
  "OCR_FRAME_REJECTED_NOT_IN_GUIDE",
  "OCR_FRAME_REJECTED_MOVING",
  "OCR_FRAME_REJECTED_BLUR",
  "OCR_FRAME_REJECTED_DARK",
  "OCR_FRAME_VALID",
  "OCR_AUTO_CAPTURE_READY",
  "OCR_CAPTURE_STARTED",
  "OCR_CAPTURE_SKIPPED_ALREADY_DONE",
  "OCR_ANALYZE_STARTED",
  "OCR_FORM_FILL_STARTED",
  "OCR_FORM_FILL_COMPLETED",
  "OCR_ANALYZE_UNREADABLE",
  "OCR_SCAN_FAILED",
  "OCR_RETRY_REQUESTED",
  "OCR_RETRY_RESET_COMPLETED",
  "OCR_RETRY_CAMERA_RESTART",
  "OCR_PAGE_RELOAD_BLOCKED",
  "OCR_ENTRY_REFRESH_SKIPPED_ON_FAILURE",
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
