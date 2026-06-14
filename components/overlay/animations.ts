import type { OverlayAnimation, OverlayPhase } from "@/components/overlay/types"

export const overlay_backdrop_duration_ms = 360
export const overlay_sheet_duration_ms = 420
export const overlay_close_duration_ms = 220
export const overlay_open_duration_ms = 420

export const overlay_ease_class = "ease-[cubic-bezier(0.16,1.15,0.32,1)]"

export function getOverlayModalAnimationClass(
  animation: OverlayAnimation,
  phase: OverlayPhase,
) {
  if (phase === "closing") {
    if (animation === "from_bottom") {
      return "modal_bottom_exit"
    }

    if (animation === "from_left") {
      return "modal_left_exit"
    }

    return "modal_center_drop_bounce_exit"
  }

  if (animation === "from_bottom") {
    return "modal_bottom_enter"
  }

  if (animation === "from_left") {
    return "modal_left_enter"
  }

  return "modal_center_drop_bounce"
}

export function getOverlayBackdropAnimationClass(phase: OverlayPhase) {
  return phase === "closing"
    ? "overlay_backdrop_exit"
    : "overlay_backdrop_enter"
}
