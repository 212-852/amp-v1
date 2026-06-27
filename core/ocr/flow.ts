export type OcrFlowState =
  | "idle"
  | "camera_starting"
  | "camera_ready"
  | "capturing"
  | "analyzing"
  | "filling_form"
  | "completed"
  | "failed"
  | "retrying"

export type OcrFailureType =
  | "camera_failed"
  | "capture_failed"
  | "ocr_unreadable"
  | "save_failed"

export type OcrFlowEvent =
  | "scan_requested"
  | "camera_started"
  | "capture_started"
  | "analyze_started"
  | "fill_started"
  | "flow_completed"
  | "flow_failed"
  | "retry_requested"
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
  capturing: {
    label: "Capturing…",
    description: "撮影しています",
    progress: 60,
  },
  analyzing: {
    label: "Analyzing…",
    description: "文字を読み取っています",
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
  failed: {
    label: "読み取りできませんでした",
    description: "免許証を枠内に合わせて、もう一度スキャンしてください",
    progress: 0,
  },
  retrying: {
    label: "Retrying…",
    description: "スキャンを再開しています",
    progress: 0,
  },
}

const OCR_FAILURE_STATUS: Record<OcrFailureType, OcrFlowStatus> = {
  camera_failed: {
    label: "カメラを起動できませんでした",
    description: "カメラ設定を確認して、もう一度スキャンしてください",
    progress: 0,
  },
  capture_failed: {
    label: "撮影できませんでした",
    description: "免許証を枠内に合わせて、もう一度スキャンしてください",
    progress: 0,
  },
  ocr_unreadable: {
    label: "読み取りできませんでした",
    description: "免許証を枠内に合わせて、もう一度スキャンしてください",
    progress: 0,
  },
  save_failed: {
    label: "保存できませんでした",
    description: "もう一度スキャンして入力内容を確認してください",
    progress: 0,
  },
}

const EVENT_STATE: Record<OcrFlowEvent, OcrFlowState> = {
  scan_requested: "camera_starting",
  camera_started: "camera_ready",
  capture_started: "capturing",
  analyze_started: "analyzing",
  fill_started: "filling_form",
  flow_completed: "completed",
  flow_failed: "failed",
  retry_requested: "retrying",
  flow_reset: "idle",
}

export function reduce_ocr_flow(
  current: OcrFlowState,
  event: OcrFlowEvent,
): OcrFlowState {
  const next = EVENT_STATE[event]

  if (
    current === "completed" &&
    event !== "flow_reset" &&
    event !== "flow_failed"
  ) {
    return current
  }

  if (
    current === "failed" &&
    event !== "retry_requested" &&
    event !== "flow_reset"
  ) {
    return current
  }

  return next
}

export function get_ocr_flow_status(
  state: OcrFlowState,
  failure_type?: OcrFailureType | null,
): OcrFlowStatus {
  if (state === "failed" && failure_type) {
    return OCR_FAILURE_STATUS[failure_type]
  }

  return OCR_FLOW_STATUS[state]
}

export function is_ocr_camera_start_blocked(state: OcrFlowState) {
  return (
    state === "camera_starting" ||
    state === "camera_ready" ||
    state === "capturing" ||
    state === "analyzing" ||
    state === "filling_form" ||
    state === "completed" ||
    state === "failed"
  )
}
