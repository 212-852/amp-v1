import type { OverlayAnimation, OverlayPhase } from "@/components/overlay/types"

const overlay_easing = "cubic-bezier(0.22, 1, 0.36, 1)"

export const overlay_open_duration_ms = 300
export const overlay_close_duration_ms = 180

export const overlay_ease_class = "ease-[cubic-bezier(0.22,1,0.36,1)]"

type AnimationPreset = {
  hidden: string
  visible: string
}

const animation_presets: Record<OverlayAnimation, AnimationPreset> = {
  from_bottom: {
    hidden: "translate-x-0 translate-y-12 opacity-0",
    visible: "translate-x-0 translate-y-0 opacity-100",
  },
  from_top: {
    hidden: "translate-x-0 -translate-y-7 opacity-0",
    visible: "translate-x-0 translate-y-0 opacity-100",
  },
  from_left: {
    hidden: "-translate-x-9 translate-y-0 opacity-0",
    visible: "translate-x-0 translate-y-0 opacity-100",
  },
}

export function getOverlayPanelTransform(
  animation: OverlayAnimation,
  phase: OverlayPhase,
) {
  const is_hidden = phase === "opening" || phase === "closing"
  const preset = animation_presets[animation]

  return is_hidden ? preset.hidden : preset.visible
}

export function getOverlayDurationClass(phase: OverlayPhase) {
  return phase === "closing" ? "duration-[180ms]" : "duration-[300ms]"
}

export function getOverlayDurationClassForAnimation(
  animation: OverlayAnimation,
  phase: OverlayPhase,
) {
  if (phase === "closing") {
    return "duration-[180ms]"
  }

  return animation === "from_top" ? "duration-[280ms]" : "duration-[300ms]"
}

export { overlay_easing }
