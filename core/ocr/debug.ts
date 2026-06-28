export const OCR_CAMERA_PERMISSION_DENIED_SESSION_KEY =
  "amp_ocr_camera_permission_denied"

export const OCR_CAMERA_PERMISSION_GRANTED_SESSION_KEY =
  "amp_ocr_camera_permission_granted"

export type OcrDebugEvent =
  | "OCR_COMPONENT_MOUNT"
  | "OCR_COMPONENT_UNMOUNT"
  | "OCR_COMPONENT_UNMOUNT_BLOCKED"
  | "OCR_COMPONENT_RENDER"
  | "OCR_SCANNER_RENDER"
  | "OCR_RENDER_BLOCKED_INACTIVE"
  | "OCR_CAMERA_START_REQUESTED"
  | "OCR_CAMERA_START_SKIPPED"
  | "OCR_CAMERA_PERMISSION_REQUESTED"
  | "OCR_CAMERA_PERMISSION_DENIED"
  | "OCR_CAMERA_STREAM_RECEIVED"
  | "OCR_CAMERA_STREAM_PENDING"
  | "OCR_CAMERA_PLAY_FAILED"
  | "OCR_CAMERA_SCAN_PAUSED"
  | "OCR_VIDEO_BLACK_PREVIEW_CHECK"
  | "OCR_VIDEO_METADATA_LOADED"
  | "OCR_VIDEO_CAN_PLAY"
  | "OCR_CAMERA_PLAYING"
  | "OCR_CAMERA_STOP"
  | "OCR_CAMERA_STOP_BLOCKED"
  | "OCR_CAMERA_START_FAILED"
  | "OCR_SCAN_STATE_CHANGED"
  | "OCR_AUTO_CAPTURE_DISABLED_INITIAL_DELAY"
  | "OCR_FRAME_REJECTED_NOT_IN_GUIDE"
  | "OCR_FRAME_REJECTED_NOT_ALIGNED"
  | "OCR_FRAME_REJECTED_BELOW_THRESHOLD"
  | "OCR_FRAME_REJECTED_MOVING"
  | "OCR_FRAME_REJECTED_BLUR"
  | "OCR_FRAME_REJECTED_DARK"
  | "OCR_FRAME_VALID"
  | "OCR_AUTO_CAPTURE_READY"
  | "OCR_CAPTURE_BUTTON_CLICKED"
  | "OCR_CAPTURE_STARTED"
  | "OCR_CAPTURE_COMPLETED"
  | "OCR_CAPTURE_SKIPPED_ALREADY_DONE"
  | "OCR_ANALYZE_STARTED"
  | "OCR_ANALYZE_COMPLETED"
  | "OCR_ANALYZE_FAILED"
  | "OCR_PROVIDER_PRIMARY_STARTED"
  | "OCR_PROVIDER_PRIMARY_SUCCESS"
  | "OCR_PROVIDER_PRIMARY_FAILED"
  | "OCR_PROVIDER_PRIMARY_UNREADABLE"
  | "OCR_PROVIDER_FALLBACK_STARTED"
  | "OCR_PROVIDER_FALLBACK_SUCCESS"
  | "OCR_PROVIDER_FALLBACK_FAILED"
  | "OCR_NORMALIZE_COMPLETED"
  | "OCR_FORM_MAP_COMPLETED"
  | "OPENAI_REQUEST_STARTED"
  | "OPENAI_REQUEST_COMPLETED"
  | "OPENAI_API_KEY_LOADED"
  | "GEMINI_API_KEY_LOADED"
  | "OCR_PIPELINE_STOPPED"
  | "OCR_FORM_FILL_STARTED"
  | "OCR_FORM_FILL_COMPLETED"
  | "OCR_SAVE_STARTED"
  | "OCR_SAVE_COMPLETED"
  | "OCR_PROGRESS_REFRESH_STARTED"
  | "OCR_PROGRESS_REFRESH_COMPLETED"
  | "OCR_ANALYZE_UNREADABLE"
  | "OCR_SCAN_FAILED"
  | "OCR_RETRY_REQUESTED"
  | "OCR_RETRY_RESET_COMPLETED"
  | "OCR_RETRY_CAMERA_RESTART"
  | "OCR_PAGE_RELOAD_BLOCKED"
  | "OCR_ENTRY_REFRESH_SKIPPED_ON_FAILURE"
  | "OCR_IMAGE_SELECTED"
  | "OCR_READ_STARTED"
  | "OCR_READ_SUCCEEDED"
  | "OCR_READ_FAILED"
  | "OCR_FORM_FILLED"
  | "OCR_NAVIGATION_REQUESTED"
  | "OCR_NAVIGATION_BLOCKED_DURING_OCR"
  | "DRIVER_TASK_MODAL_OPEN"
  | "DRIVER_TASK_MODAL_OPEN_SKIPPED"
  | "DRIVER_TASK_MODAL_BODY_RENDER"
  | "DRIVER_TASK_MODAL_CLOSE_REQUESTED"
  | "DRIVER_TASK_MODAL_CLOSE_BLOCKED"
  | "DRIVER_TASK_MODAL_CLOSED"
  | "REACT_STRICT_MODE_DUPLICATE_MOUNT_DETECTED"

export type OcrCameraErrorKind =
  | "permission_denied"
  | "permission_dismissed"
  | "unavailable"
  | "failed"

export type CameraPermissionState = "unknown" | "granted" | "denied"

type OcrDebugContext = {
  component_instance_id: string
  document_type: string
  scan_state: string
  camera_state: string
}

const OCR_DEBUG_ENABLED = process.env.NEXT_PUBLIC_OCR_DEBUG === "true"
const OCR_DEBUG_VERBOSE =
  process.env.NEXT_PUBLIC_OCR_DEBUG_VERBOSE === "true"
const last_debug_at = new Map<string, number>()
let debug_delivery_chain: Promise<void> = Promise.resolve()
let active_debug_context: OcrDebugContext = {
  component_instance_id: "unscoped",
  document_type: "unknown",
  scan_state: "unknown",
  camera_state: "unknown",
}

const VERBOSE_DEBUG_EVENTS = new Set<OcrDebugEvent>([
  "OCR_COMPONENT_RENDER",
  "OCR_AUTO_CAPTURE_DISABLED_INITIAL_DELAY",
  "OCR_VIDEO_CAN_PLAY",
  "OCR_VIDEO_METADATA_LOADED",
  "OCR_FRAME_REJECTED_NOT_IN_GUIDE",
  "OCR_FRAME_REJECTED_NOT_ALIGNED",
  "OCR_FRAME_REJECTED_BELOW_THRESHOLD",
  "OCR_FRAME_REJECTED_MOVING",
  "OCR_FRAME_REJECTED_BLUR",
  "OCR_FRAME_REJECTED_DARK",
  "OCR_FRAME_VALID",
])

const REQUIRED_OCR_LIFECYCLE_EVENTS = new Set<OcrDebugEvent>([
  "DRIVER_TASK_MODAL_OPEN",
  "DRIVER_TASK_MODAL_OPEN_SKIPPED",
  "DRIVER_TASK_MODAL_BODY_RENDER",
  "DRIVER_TASK_MODAL_CLOSE_REQUESTED",
  "DRIVER_TASK_MODAL_CLOSE_BLOCKED",
  "DRIVER_TASK_MODAL_CLOSED",
  "REACT_STRICT_MODE_DUPLICATE_MOUNT_DETECTED",
  "OCR_COMPONENT_MOUNT",
  "OCR_SCANNER_RENDER",
  "OCR_COMPONENT_UNMOUNT",
  "OCR_RENDER_BLOCKED_INACTIVE",
  "OCR_CAMERA_START_REQUESTED",
  "OCR_CAMERA_PERMISSION_REQUESTED",
  "OCR_CAMERA_STREAM_RECEIVED",
  "OCR_CAMERA_PLAYING",
  "OCR_CAPTURE_STARTED",
  "OCR_CAPTURE_COMPLETED",
  "OCR_ANALYZE_STARTED",
  "OCR_ANALYZE_COMPLETED",
  "OCR_FORM_MAP_COMPLETED",
  "OCR_FORM_FILL_STARTED",
  "OCR_FORM_FILL_COMPLETED",
  "OCR_SAVE_STARTED",
  "OCR_SAVE_COMPLETED",
])

export function is_ocr_debug_event_enabled(event: OcrDebugEvent) {
  return (
    REQUIRED_OCR_LIFECYCLE_EVENTS.has(event) ||
    (OCR_DEBUG_ENABLED &&
      (!VERBOSE_DEBUG_EVENTS.has(event) || OCR_DEBUG_VERBOSE))
  )
}

export function set_ocr_debug_context(context: Partial<OcrDebugContext>) {
  active_debug_context = { ...active_debug_context, ...context }
}

export function enrich_ocr_debug_payload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...active_debug_context,
    ...payload,
    component_instance_id:
      payload.component_instance_id ?? active_debug_context.component_instance_id,
    document_type: payload.document_type ?? active_debug_context.document_type,
    scan_state: payload.scan_state ?? active_debug_context.scan_state,
    camera_state: payload.camera_state ?? active_debug_context.camera_state,
  }
}

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
  interval_ms?: number,
) {
  if (!is_ocr_debug_event_enabled(event)) {
    return
  }

  if (!should_log_ocr_debug_event(event)) {
    return
  }

  const enriched_payload = enrich_ocr_debug_payload(payload)
  const interval =
    interval_ms ?? (VERBOSE_DEBUG_EVENTS.has(event) ? 3_000 : 2_000)
  const key = [
    event,
    enriched_payload.component_instance_id,
    enriched_payload.document_type,
    enriched_payload.reason ?? "",
    enriched_payload.scan_state,
    enriched_payload.camera_state,
  ].join(":")
  const now = Date.now()
  const last = last_debug_at.get(key) ?? 0

  if (now - last < interval) {
    return
  }

  last_debug_at.set(key, now)

  debug_delivery_chain = debug_delivery_chain
    .catch(() => undefined)
    .then(async () => {
      try {
        await fetch("/api/debug/client", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event,
            ...enriched_payload,
          }),
        })
      } catch {
        // Client-side debug must never block OCR flow.
      }
    })

  await debug_delivery_chain
}

export function debug_ocr_once_per_interval(
  event: OcrDebugEvent,
  payload: Record<string, unknown>,
  interval_ms = 2_000,
) {
  void send_ocr_debug(event, payload, interval_ms)
}
