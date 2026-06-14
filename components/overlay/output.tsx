"use client"

import {
  getOverlayDurationClassForAnimation,
  overlay_ease_class,
} from "@/components/overlay/animations"
import OverlayModal from "@/components/overlay/modal"
import type { OverlayAction, OverlayPhase } from "@/components/overlay/types"

function getOverlayPlacementClass(action: OverlayAction) {
  if (action.rule.placement === "bottom") {
    return [
      "items-end justify-center",
      "px-4 pt-[calc(20px+env(safe-area-inset-top,0px))]",
      "pb-[calc(12px+env(safe-area-inset-bottom,0px))]",
    ].join(" ")
  }

  if (action.rule.placement === "left") {
    return [
      "items-center justify-start",
      "pl-4 pr-8",
      "py-[calc(20px+env(safe-area-inset-top,0px))]",
      "pb-[calc(20px+env(safe-area-inset-bottom,0px))]",
    ].join(" ")
  }

  return [
    "items-start justify-center",
    "px-4 pt-[calc(20px+env(safe-area-inset-top,0px))]",
    "pb-[calc(20px+env(safe-area-inset-bottom,0px))]",
  ].join(" ")
}

function getOverlayContentClass(action: OverlayAction) {
  if (action.rule.placement === "left") {
    return "relative z-[1010] flex w-full justify-start"
  }

  return "relative z-[1010] flex w-full justify-center"
}

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
        "fixed inset-0 z-[1000] flex",
        getOverlayPlacementClass(action),
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
          "absolute inset-0 bg-[rgba(0,0,0,0.42)] backdrop-blur-[8px]",
          "transition-opacity",
          getOverlayDurationClassForAnimation(action.rule.animation, phase),
          overlay_ease_class,
          is_visible ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      <div className={getOverlayContentClass(action)}>
        <OverlayModal
          rule={action.rule}
          phase={phase}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
