"use client"

import type { ToastTone } from "@/components/ui/use_toast"

const tone_styles: Record<
  ToastTone,
  { container: string; icon: string }
> = {
  success: {
    container: "border-[#22c55e] bg-[#dcfce7] text-[#14532d]",
    icon: "bg-[#16a34a]",
  },
  error: {
    container: "border-[#ef4444] bg-[#fef2f2] text-[#7f1d1d]",
    icon: "bg-[#dc2626]",
  },
  info: {
    container: "border-[#3b82f6] bg-[#eff6ff] text-[#1e3a8a]",
    icon: "bg-[#2563eb]",
  },
  warning: {
    container: "border-[#f59e0b] bg-[#fffbeb] text-[#78350f]",
    icon: "bg-[#d97706]",
  },
}

export type ToastAnchorRect = {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

export type ToastItem = {
  id: string
  message: string
  tone: ToastTone
  anchor_rect?: ToastAnchorRect | null
  compact?: boolean
}

export function ToastView({
  item,
}: Readonly<{
  item: ToastItem
}>) {
  const styles = tone_styles[item.tone]

  if (item.compact) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={[
          "rounded-xl border px-3 py-2 text-[12px] font-medium leading-snug shadow-[0_8px_24px_rgba(0,0,0,0.12)]",
          styles.container,
        ].join(" ")}
      >
        {item.message}
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "flex items-start gap-2.5 rounded-2xl border px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.08)]",
        styles.container,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={["mt-1.5 h-2 w-2 shrink-0 rounded-full", styles.icon].join(" ")}
      />
      <p className="text-[13px] font-medium leading-snug">{item.message}</p>
    </div>
  )
}

function AnchoredToastView({ item }: Readonly<{ item: ToastItem }>) {
  if (!item.anchor_rect) {
    return null
  }

  const center_x = item.anchor_rect.left + item.anchor_rect.width / 2

  return (
    <div
      className="pointer-events-none fixed z-[200] max-w-[min(92vw,240px)] -translate-x-1/2"
      style={{
        top: item.anchor_rect.bottom + 6,
        left: center_x,
      }}
    >
      <ToastView item={{ ...item, compact: true }} />
    </div>
  )
}

export function ToastStack({ items }: Readonly<{ items: ToastItem[] }>) {
  if (items.length === 0) {
    return null
  }

  const default_items = items.filter((item) => !item.anchor_rect)
  const anchored_items = items.filter((item) => item.anchor_rect)

  return (
    <>
      {default_items.length > 0 ? (
        <div
          className={[
            "pointer-events-none fixed left-1/2 z-[200] flex w-[min(92vw,360px)] -translate-x-1/2 flex-col gap-2",
            "bottom-[calc(16px+env(safe-area-inset-bottom,0px))]",
            "md:bottom-auto md:top-[calc(88px+env(safe-area-inset-top,0px))]",
          ].join(" ")}
        >
          {default_items.map((item) => (
            <ToastView key={item.id} item={item} />
          ))}
        </div>
      ) : null}
      {anchored_items.map((item) => (
        <AnchoredToastView key={item.id} item={item} />
      ))}
    </>
  )
}
