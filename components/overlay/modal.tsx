import { getOverlayModalAnimationClass } from "@/components/overlay/animations"
import type { OverlayPhase, OverlayRule } from "@/components/overlay/types"

function getModalLayoutClass(rule: OverlayRule) {
  if (rule.placement === "bottom") {
    return [
      "w-full max-w-none rounded-t-[28px] rounded-b-none border-b-0",
      "pb-[calc(env(safe-area-inset-bottom)+16px)]",
    ].join(" ")
  }

  if (rule.placement === "left") {
    return [
      "h-dvh w-[min(82vw,360px)] max-w-none rounded-none rounded-r-[28px] border-l-0",
      "overflow-y-auto",
      "pt-[calc(env(safe-area-inset-top)+24px)]",
      "pb-[calc(env(safe-area-inset-bottom)+24px)]",
    ].join(" ")
  }

  return [
    "fixed left-1/2 top-1/2 w-[calc(100%-40px)]",
    "max-w-[360px] rounded-[28px] py-5",
  ].join(" ")
}

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
        getModalLayoutClass(rule),
        "border border-[#e5e5e5] bg-white px-5 text-[#111111]",
        "shadow-[0_18px_50px_rgba(0,0,0,0.12)]",
        "will-change-transform",
        getOverlayModalAnimationClass(rule.animation, phase),
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="overlay-title"
            className="mb-4 text-[24px] font-bold tracking-[-0.03em]"
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
