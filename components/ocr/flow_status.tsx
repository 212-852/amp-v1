import {
  get_ocr_flow_status,
  type OcrFlowState,
} from "@/core/ocr/flow"

export default function OcrFlowStatus({
  state,
}: Readonly<{ state: OcrFlowState }>) {
  const status = get_ocr_flow_status(state)

  return (
    <div
      className="sticky top-0 z-20 rounded-xl border border-neutral-200 bg-white px-3 py-3 shadow-sm"
      role="status"
      aria-live="polite"
      data-ocr-flow-state={state}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-900">{status.label}</p>
        <span className="text-xs font-semibold tabular-nums text-neutral-600">
          {status.progress}%
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200"
        role="progressbar"
        aria-label={status.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={status.progress}
      >
        <div
          className="h-full rounded-full bg-neutral-900 transition-[width] duration-300 ease-out"
          style={{ width: `${status.progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-neutral-600">
        {status.description}
      </p>
    </div>
  )
}
