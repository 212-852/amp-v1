"use client"

import type { ToastTone } from "@/components/ui/use_toast"

const tone_styles: Record<
  ToastTone,
  { container: string; icon: string }
> = {
  success: {
    container: "border-0 bg-[rgba(0,0,0,0.82)] text-white",
    icon: "bg-white/85",
  },
  error: {
    container: "border-0 bg-[rgba(0,0,0,0.82)] text-white",
    icon: "bg-white/85",
  },
  info: {
    container: "border-0 bg-[rgba(0,0,0,0.82)] text-white",
    icon: "bg-white/85",
  },
  warning: {
    container: "border-0 bg-[rgba(0,0,0,0.82)] text-white",
    icon: "bg-white/85",
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
  placement?: "default" | "center"
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
          "rounded-[16px] px-4 py-3 text-center text-[13px] font-semibold leading-snug shadow-[0_10px_26px_rgba(0,0,0,0.20)] backdrop-blur-[12px]",
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
        "flex items-start gap-2.5 rounded-[16px] px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.18)] backdrop-blur-[12px]",
        styles.container,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={["mt-1.5 h-2 w-2 shrink-0 rounded-full", styles.icon].join(" ")}
      />
      <p className="whitespace-pre-line text-[13px] font-medium leading-snug">
        {item.message}
      </p>
    </div>
  )
}

function AnchoredToastView({ item }: Readonly<{ item: ToastItem }>) {
  if (!item.anchor_rect) {
    return null
  }

  const center_x = item.anchor_rect.left + item.anchor_rect.width / 2
  const should_place_above =
    typeof window !== "undefined" &&
    item.anchor_rect.bottom + 86 > window.innerHeight

  return (
    <div
      className="pointer-events-none fixed z-[200] max-w-[min(92vw,240px)] -translate-x-1/2"
      style={
        should_place_above
          ? {
              bottom: window.innerHeight - item.anchor_rect.top + 6,
              left: center_x,
            }
          : {
              top: item.anchor_rect.bottom + 6,
              left: center_x,
            }
      }
    >
      <ToastView item={{ ...item, compact: true }} />
    </div>
  )
}

export function ToastStack({ items }: Readonly<{ items: ToastItem[] }>) {
  if (items.length === 0) {
    return null
  }

  const center_items = items.filter(
    (item) => !item.anchor_rect && item.placement === "center",
  )
  const default_items = items.filter(
    (item) => !item.anchor_rect && item.placement !== "center",
  )
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
      {center_items.length > 0 ? (
        <div
          className={[
            "pointer-events-none fixed left-1/2 top-1/2 z-[220] flex w-[min(86vw,340px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-2",
          ].join(" ")}
        >
          {center_items.map((item) => (
            <ToastView key={item.id} item={{ ...item, compact: true }} />
          ))}
        </div>
      ) : null}
    </>
  )
}
