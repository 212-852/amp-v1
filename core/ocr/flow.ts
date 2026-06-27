export type OcrFlowState =
  | "idle"
  | "starting_camera"
  | "camera_ready"
  | "capturing"
  | "captured"
  | "analyzing"
  | "filling_form"
  | "completed"
  | "error"

export type OcrFlowEvent =
  | "scan_requested"
  | "camera_started"
  | "capture_started"
  | "capture_completed"
  | "analyze_started"
  | "fill_started"
  | "flow_completed"
  | "flow_failed"
  | "flow_reset"

export type OcrFlowStatus = {
  label: string
  description: string
  progress: number
}

const OCR_FLOW_STATUS: Record<OcrFlowState, OcrFlowStatus> = {
  idle: {
    label: "Ready to scan",
    description: "スキャンを開始してください",
    progress: 0,
  },
  starting_camera: {
    label: "Camera starting…",
    description: "カメラを起動しています",
    progress: 20,
  },
  camera_ready: {
    label: "Camera ready",
    description: "免許証を撮影してください",
    progress: 20,
  },
  capturing: {
    label: "Capturing…",
    description: "画像を取得しています",
    progress: 40,
  },
  captured: {
    label: "Image captured",
    description: "画像を取得しました",
    progress: 40,
  },
  analyzing: {
    label: "Analyzing…",
    description: "文字を解析しています",
    progress: 70,
  },
  filling_form: {
    label: "Applying…",
    description: "フォームへ入力しています",
    progress: 90,
  },
  completed: {
    label: "Completed",
    description: "入力が完了しました",
    progress: 100,
  },
  error: {
    label: "Failed",
    description: "処理に失敗しました。もう一度お試しください",
    progress: 0,
  },
}

const EVENT_STATE: Record<OcrFlowEvent, OcrFlowState> = {
  scan_requested: "starting_camera",
  camera_started: "camera_ready",
  capture_started: "capturing",
  capture_completed: "captured",
  analyze_started: "analyzing",
  fill_started: "filling_form",
  flow_completed: "completed",
  flow_failed: "error",
  flow_reset: "idle",
}

export function reduce_ocr_flow(
  current: OcrFlowState,
  event: OcrFlowEvent,
): OcrFlowState {
  const next = EVENT_STATE[event]

  if (current === "completed" && event !== "scan_requested" && event !== "flow_reset") {
    return current
  }

  return next
}

export function get_ocr_flow_status(state: OcrFlowState): OcrFlowStatus {
  return OCR_FLOW_STATUS[state]
}

export function is_ocr_camera_start_blocked(state: OcrFlowState) {
  return (
    state === "starting_camera" ||
    state === "camera_ready" ||
    state === "capturing" ||
    state === "captured" ||
    state === "analyzing" ||
    state === "filling_form" ||
    state === "completed"
  )
}
