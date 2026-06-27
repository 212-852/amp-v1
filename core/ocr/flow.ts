export type OcrFlowState =
  | "idle"
  | "camera_starting"
  | "camera_ready"
  | "detecting"
  | "ready_to_capture"
  | "capturing"
  | "analyzing"
  | "filling_form"
  | "completed"
  | "error"

export type OcrFlowEvent =
  | "scan_requested"
  | "camera_started"
  | "detection_started"
  | "document_stable"
  | "capture_started"
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
  camera_starting: {
    label: "Camera starting…",
    description: "カメラを起動しています",
    progress: 10,
  },
  camera_ready: {
    label: "Camera ready",
    description: "免許証を枠内に合わせてください",
    progress: 20,
  },
  detecting: {
    label: "Detecting…",
    description: "枠内で止めてください",
    progress: 30,
  },
  ready_to_capture: {
    label: "Ready to capture",
    description: "そのまま動かさないでください",
    progress: 45,
  },
  capturing: {
    label: "Capturing…",
    description: "撮影しています",
    progress: 60,
  },
  analyzing: {
    label: "Analyzing…",
    description: "文字を解析しています",
    progress: 80,
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
    description: "読み込みできませんでした",
    progress: 0,
  },
}

const EVENT_STATE: Record<OcrFlowEvent, OcrFlowState> = {
  scan_requested: "camera_starting",
  camera_started: "camera_ready",
  detection_started: "detecting",
  document_stable: "ready_to_capture",
  capture_started: "capturing",
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

  if (current === "completed" && event !== "flow_reset") {
    return current
  }

  return next
}

export function get_ocr_flow_status(state: OcrFlowState): OcrFlowStatus {
  return OCR_FLOW_STATUS[state]
}

export function is_ocr_camera_start_blocked(state: OcrFlowState) {
  return (
    state === "camera_starting" ||
    state === "camera_ready" ||
    state === "detecting" ||
    state === "ready_to_capture" ||
    state === "capturing" ||
    state === "analyzing" ||
    state === "filling_form" ||
    state === "completed"
  )
}
