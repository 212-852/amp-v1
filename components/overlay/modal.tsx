import {
  getOverlayDurationClass,
  getOverlayPanelTransform,
  overlay_ease_class,
} from "@/components/overlay/animations"
import type { OverlayPhase, OverlayRule } from "@/components/overlay/types"

export default function OverlayModal({
  rule,
  phase,
  onClose,
}: Readonly<{
  rule: OverlayRule
  phase: OverlayPhase
  onClose: () => void
}>) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlay-title"
      className={[
        "w-[calc(100%-32px)] max-w-[420px] border border-[#e5e5e5]",
        "rounded-[28px] bg-white p-5 text-[#111111]",
        "shadow-[0_18px_50px_rgba(0,0,0,0.12)]",
        "transition-[opacity,transform]",
        getOverlayDurationClass(phase),
        overlay_ease_class,
        getOverlayPanelTransform(rule.animation, phase),
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#777777]">
            {rule.source}
          </p>
          <h2
            id="overlay-title"
            className="mt-2 text-[22px] font-semibold tracking-[-0.03em]"
          >
            {rule.title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] text-[18px] leading-none text-[#777777]"
          aria-label="Close overlay"
        >
          ×
        </button>
      </div>

      <p className="mt-3 text-[13px] font-medium leading-6 text-[#777777]">
        {rule.description}
      </p>

      <div className="mt-5 grid gap-2">
        {rule.items.map((item) => (
          <button
            key={item}
            type="button"
            className="rounded-2xl border border-[#e5e5e5] px-4 py-3 text-left text-[14px] font-semibold text-[#111111]"
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  )
}
