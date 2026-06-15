import { ChevronRight, Mail } from "lucide-react"
import { SiGoogle, SiLine } from "react-icons/si"

import { getOverlayModalAnimationClass } from "@/components/overlay/animations"
import type {
  OverlayItem,
  OverlayPhase,
  OverlayRule,
} from "@/components/overlay/types"

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
    "max-w-[380px] rounded-[28px] py-5",
  ].join(" ")
}

function getLinkHref(action: NonNullable<OverlayItem["action"]>) {
  return `/api/auth/${action}`
}

function handleLinkOption(item: OverlayItem) {
  if (!item.action) {
    return
  }

  window.location.href = getLinkHref(item.action)
}

function LinkOptionIcon({ action }: Readonly<{ action: OverlayItem["action"] }>) {
  if (action === "line") {
    return <SiLine className="h-7 w-7 text-[#06c755]" aria-hidden="true" />
  }

  if (action === "google") {
    return <SiGoogle className="h-7 w-7 text-[#4285f4]" aria-hidden="true" />
  }

  return <Mail className="h-7 w-7 text-[#8f5d28]" strokeWidth={2} aria-hidden="true" />
}

function LinkOption({ item }: Readonly<{ item: OverlayItem }>) {
  return (
    <button
      type="button"
      onClick={() => handleLinkOption(item)}
      className={[
        "grid min-h-[86px] w-full grid-cols-[44px_minmax(0,1fr)_24px]",
        "items-center gap-3 rounded-[18px] border border-[#e5e5e5]",
        "bg-white px-4 py-3 text-left text-[#111111]",
        "transition-colors hover:bg-[#fdfaf6] focus-visible:outline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f5d28]",
      ].join(" ")}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f8f8f8]">
        <LinkOptionIcon action={item.action} />
      </span>

      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-bold leading-5">
            {item.title}
          </span>
          {item.badge ? (
            <span className="shrink-0 rounded-full bg-[#06c755] px-2 py-0.5 text-[11px] font-bold leading-none text-white">
              {item.badge}
            </span>
          ) : null}
        </span>
        {item.description ? (
          <span className="mt-1 block text-[12px] font-semibold leading-5 text-[#777777]">
            {item.description}
          </span>
        ) : null}
      </span>

      <ChevronRight
        className="h-5 w-5 justify-self-end text-[#9a9a9a]"
        strokeWidth={2.4}
        aria-hidden="true"
      />
    </button>
  )
}

function DefaultOption({ item }: Readonly<{ item: OverlayItem }>) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-[#e5e5e5] px-4 py-3 text-left text-[14px] font-semibold text-[#111111]"
    >
      {item.title}
    </button>
  )
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
          rule.type === "link" ? (
            <LinkOption key={item.id} item={item} />
          ) : (
            <DefaultOption key={item.id} item={item} />
          )
        ))}
      </div>
    </section>
  )
}
