"use client"

import {
  getOverlayDurationClass,
  overlay_ease_class,
} from "@/components/overlay/animations"
import OverlayModal from "@/components/overlay/modal"
import type { OverlayAction, OverlayPhase } from "@/components/overlay/types"

export default function OverlayOutput({
  action,
  phase,
  onClose,
}: Readonly<{
  action: OverlayAction
  phase: OverlayPhase
  onClose: () => void
}>) {
  const is_visible = phase === "open"

  return (
    <div
      className={[
        "fixed inset-0 z-[100] flex items-center justify-center",
        "px-4 py-[calc(20px+env(safe-area-inset-top,0px))]",
        "pb-[calc(20px+env(safe-area-inset-bottom,0px))]",
      ].join(" ")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        aria-hidden="true"
        className={[
          "absolute inset-0 bg-black/35 backdrop-blur-sm",
          "transition-opacity",
          getOverlayDurationClass(phase),
          overlay_ease_class,
          is_visible ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      <div className="relative z-10 flex w-full justify-center">
        <OverlayModal
          rule={action.rule}
          phase={phase}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
