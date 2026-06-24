export const OCR_CAMERA_PERMISSION_DENIED_SESSION_KEY =
  "amp_ocr_camera_permission_denied"

export const OCR_CAMERA_PERMISSION_GRANTED_SESSION_KEY =
  "amp_ocr_camera_permission_granted"

export type OcrDebugEvent =
  | "OCR_CAMERA_PERMISSION_REQUESTED"
  | "OCR_CAMERA_PERMISSION_DENIED"
  | "OCR_IMAGE_SELECTED"
  | "OCR_READ_STARTED"
  | "OCR_READ_SUCCEEDED"
  | "OCR_READ_FAILED"
  | "OCR_FORM_FILLED"

export type OcrCameraErrorKind =
  | "permission_denied"
  | "permission_dismissed"
  | "unavailable"
  | "failed"

export type CameraPermissionState = "unknown" | "granted" | "denied"

const ONCE_PER_SESSION_DEBUG_EVENTS = new Set<OcrDebugEvent>([
  "OCR_CAMERA_PERMISSION_DENIED",
  "OCR_READ_FAILED",
  "OCR_FORM_FILLED",
])

export function read_camera_permission_denied_session() {
  if (typeof sessionStorage === "undefined") {
    return false
  }

  return sessionStorage.getItem(OCR_CAMERA_PERMISSION_DENIED_SESSION_KEY) === "1"
}

export function read_camera_permission_granted_session() {
  if (typeof sessionStorage === "undefined") {
    return false
  }

  return sessionStorage.getItem(OCR_CAMERA_PERMISSION_GRANTED_SESSION_KEY) === "1"
}

export function mark_camera_permission_denied_session() {
  if (typeof sessionStorage === "undefined") {
    return
  }

  sessionStorage.setItem(OCR_CAMERA_PERMISSION_DENIED_SESSION_KEY, "1")
}

export function mark_camera_permission_granted_session() {
  if (typeof sessionStorage === "undefined") {
    return
  }

  sessionStorage.setItem(OCR_CAMERA_PERMISSION_GRANTED_SESSION_KEY, "1")
}

export function get_camera_permission_state(): CameraPermissionState {
  if (read_camera_permission_denied_session()) {
    return "denied"
  }

  if (read_camera_permission_granted_session()) {
    return "granted"
  }

  return "unknown"
}

export function is_permission_dismissed_message(error_message: string) {
  return error_message.toLowerCase().includes("dismiss")
}

export function resolve_ocr_camera_error_kind(input: {
  error_name: string | null | undefined
  error_message?: string | null
}): OcrCameraErrorKind {
  if (
    input.error_name === "NotAllowedError" ||
    input.error_name === "PermissionDeniedError" ||
    input.error_name === "SecurityError"
  ) {
    if (is_permission_dismissed_message(input.error_message ?? "")) {
      return "permission_dismissed"
    }

    return "permission_denied"
  }

  if (
    input.error_name === "NotSupportedError" ||
    input.error_name === "NotFoundError" ||
    input.error_name === "OverconstrainedError"
  ) {
    return "unavailable"
  }

  return "failed"
}

export function should_log_ocr_debug_event(event: OcrDebugEvent) {
  if (!ONCE_PER_SESSION_DEBUG_EVENTS.has(event)) {
    return true
  }

  if (typeof sessionStorage === "undefined") {
    return true
  }

  const key = `amp_ocr_debug:${event}`

  if (sessionStorage.getItem(key) === "1") {
    return false
  }

  sessionStorage.setItem(key, "1")
  return true
}

export async function send_ocr_debug(
  event: OcrDebugEvent,
  payload: Record<string, unknown>,
) {
  if (!should_log_ocr_debug_event(event)) {
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
    // Client-side debug must never block OCR flow.
  }
}
