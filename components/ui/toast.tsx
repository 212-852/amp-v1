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

export type ToastItem = {
  id: string
  message: string
  tone: ToastTone
}

export function ToastView({ item }: { item: ToastItem }) {
  const styles = tone_styles[item.tone]

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

export function ToastStack({ items }: { items: ToastItem[] }) {
  if (items.length === 0) {
    return null
  }

  return (
    <div
      className={[
        "pointer-events-none fixed left-1/2 z-[200] flex w-[min(92vw,360px)] -translate-x-1/2 flex-col gap-2",
        "bottom-[calc(16px+env(safe-area-inset-bottom,0px))]",
        "md:bottom-auto md:top-[calc(88px+env(safe-area-inset-top,0px))]",
      ].join(" ")}
    >
      {items.map((item) => (
        <ToastView key={item.id} item={item} />
      ))}
    </div>
  )
}
