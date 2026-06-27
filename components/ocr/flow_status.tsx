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
      className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/90 via-black/70 to-transparent px-3 pb-7 pt-3 text-white"
      role="status"
      aria-live="polite"
      data-ocr-flow-state={state}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{status.label}</p>
        <span className="text-xs font-semibold tabular-nums text-white/80">
          {status.progress}%
        </span>
      </div>
      <p className="mt-0.5 text-xs leading-5 text-white/80">
        {status.description}
      </p>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25"
        role="progressbar"
        aria-label={status.label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={status.progress}
      >
        <div
          className="h-full rounded-full bg-white transition-[width] duration-300 ease-out"
          style={{ width: `${status.progress}%` }}
        />
      </div>
    </div>
  )
}
