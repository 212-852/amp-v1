export const OCR_CAMERA_PERMISSION_DENIED_SESSION_KEY =
  "amp_ocr_camera_permission_denied"

export type OcrCameraDebugEvent =
  | "OCR_CAMERA_PERMISSION_DENIED"
  | "OCR_CAMERA_UNAVAILABLE"
  | "OCR_CAMERA_FAILED"

export type OcrCameraErrorKind = "permission_denied" | "unavailable" | "failed"

export function read_camera_permission_denied_session() {
  if (typeof sessionStorage === "undefined") {
    return false
  }

  return sessionStorage.getItem(OCR_CAMERA_PERMISSION_DENIED_SESSION_KEY) === "1"
}

export function mark_camera_permission_denied_session() {
  if (typeof sessionStorage === "undefined") {
    return
  }

  sessionStorage.setItem(OCR_CAMERA_PERMISSION_DENIED_SESSION_KEY, "1")
}

export function resolve_ocr_camera_error_kind(
  error_name: string | null | undefined,
): OcrCameraErrorKind {
  if (
    error_name === "NotAllowedError" ||
    error_name === "PermissionDeniedError" ||
    error_name === "SecurityError"
  ) {
    return "permission_denied"
  }

  if (
    error_name === "NotSupportedError" ||
    error_name === "NotFoundError" ||
    error_name === "OverconstrainedError"
  ) {
    return "unavailable"
  }

  return "failed"
}

export function resolve_ocr_camera_debug_event(
  error_kind: OcrCameraErrorKind,
): OcrCameraDebugEvent {
  if (error_kind === "permission_denied") {
    return "OCR_CAMERA_PERMISSION_DENIED"
  }

  if (error_kind === "unavailable") {
    return "OCR_CAMERA_UNAVAILABLE"
  }

  return "OCR_CAMERA_FAILED"
}

export function should_log_ocr_camera_debug_event(event: OcrCameraDebugEvent) {
  if (event !== "OCR_CAMERA_PERMISSION_DENIED") {
    return true
  }

  if (typeof sessionStorage === "undefined") {
    return true
  }

  const key = `${OCR_CAMERA_PERMISSION_DENIED_SESSION_KEY}:logged`

  if (sessionStorage.getItem(key) === "1") {
    return false
  }

  sessionStorage.setItem(key, "1")
  return true
}

export async function send_ocr_camera_debug(
  event: OcrCameraDebugEvent,
  payload: Record<string, unknown>,
) {
  if (!should_log_ocr_camera_debug_event(event)) {
    return
  }

  try {
    await fetch("/api/debug/client", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event,
        ...payload,
      }),
    })
  } catch {
    // Client-side debug must never block camera startup.
  }
}
