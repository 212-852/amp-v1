import type { OverlayAnimation, OverlayPhase } from "@/components/overlay/types"

const overlay_easing = "cubic-bezier(0.22, 1, 0.36, 1)"

export const overlay_open_duration_ms = 360
export const overlay_close_duration_ms = 220

export const overlay_ease_class = "ease-[cubic-bezier(0.22,1,0.36,1)]"

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

    return "modal_float_exit"
  }

  if (animation === "from_bottom") {
    return "modal_bottom_enter"
  }

  if (animation === "from_left") {
    return "modal_left_enter"
  }

  return "modal_float_enter"
}

export function getOverlayBackdropAnimationClass(phase: OverlayPhase) {
  return phase === "closing"
    ? "overlay_backdrop_exit"
    : "overlay_backdrop_enter"
}

export function getOverlayDurationClassForAnimation(
  animation: OverlayAnimation,
  phase: OverlayPhase,
) {
  if (phase === "closing") {
    return "duration-[220ms]"
  }

  if (animation === "from_bottom") {
    return "duration-[480ms]"
  }

  if (animation === "from_left") {
    return "duration-[460ms]"
  }

  return "duration-[440ms]"
}

export { overlay_easing }
