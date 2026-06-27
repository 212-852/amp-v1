export const OCR_PIPELINE_SEQUENCE = [
  "OCR_CAPTURE_STARTED",
  "OCR_CAPTURE_COMPLETED",
  "OCR_ANALYZE_STARTED",
  "OCR_PROVIDER_PRIMARY_STARTED",
  "OCR_ANALYZE_COMPLETED",
  "OCR_NORMALIZE_COMPLETED",
  "OCR_FORM_MAP_COMPLETED",
  "OCR_FORM_FILL_STARTED",
  "OCR_FORM_FILL_COMPLETED",
  "OCR_SAVE_STARTED",
  "OCR_SAVE_COMPLETED",
] as const

export type OcrPipelineStep = (typeof OCR_PIPELINE_SEQUENCE)[number]

export class OcrPipelineStopError extends Error {
  readonly stopped_at: OcrPipelineStep | "pipeline_complete"
  readonly expected_step: OcrPipelineStep | null
  readonly received_step: string | null

  constructor(input: {
    stopped_at: OcrPipelineStep | "pipeline_complete"
    expected_step: OcrPipelineStep | null
    received_step?: string | null
    message: string
  }) {
    super(input.message)
    this.name = "OcrPipelineStopError"
    this.stopped_at = input.stopped_at
    this.expected_step = input.expected_step
    this.received_step = input.received_step ?? null
  }
}

export type OcrPipelineTrackerState = {
  completed_steps: OcrPipelineStep[]
  next_expected_step: OcrPipelineStep | null
  stopped_at: OcrPipelineStep | null
  stop_reason: string | null
}

export function create_ocr_pipeline_tracker(
  initial_steps: OcrPipelineStep[] = [],
) {
  const completed_steps = [...initial_steps]

  function next_expected_step(): OcrPipelineStep | null {
    return OCR_PIPELINE_SEQUENCE[completed_steps.length] ?? null
  }

  function assert_next_step(step: OcrPipelineStep) {
    const expected = next_expected_step()

    if (step !== expected) {
      throw new OcrPipelineStopError({
        stopped_at: expected ?? "pipeline_complete",
        expected_step: expected,
        received_step: step,
        message: expected
          ? `OCR pipeline stopped before ${expected}. Received ${step}.`
          : `OCR pipeline already completed. Received ${step}.`,
      })
    }
  }

  function complete_step(step: OcrPipelineStep) {
    assert_next_step(step)
    completed_steps.push(step)
  }

  function merge_completed_steps(steps: OcrPipelineStep[]) {
    for (const step of steps) {
      complete_step(step)
    }
  }

  function snapshot(): OcrPipelineTrackerState {
    return {
      completed_steps: [...completed_steps],
      next_expected_step: next_expected_step(),
      stopped_at: null,
      stop_reason: null,
    }
  }

  function build_stop_state(error: OcrPipelineStopError): OcrPipelineTrackerState {
    return {
      completed_steps: [...completed_steps],
      next_expected_step: error.expected_step,
      stopped_at:
        error.expected_step ??
        completed_steps[completed_steps.length - 1] ??
        null,
      stop_reason: error.message,
    }
  }

  return {
    complete_step,
    merge_completed_steps,
    next_expected_step,
    snapshot,
    build_stop_state,
  }
}

export function find_first_missing_pipeline_step(
  completed_steps: OcrPipelineStep[],
) {
  for (const step of OCR_PIPELINE_SEQUENCE) {
    if (!completed_steps.includes(step)) {
      return step
    }
  }

  return null
}
