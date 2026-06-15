import type { SourceChannel } from "@/core/auth/types"

type LiffWindow = Window & {
  liff?: {
    isInClient?: () => boolean
  }
}

type StandaloneNavigator = Navigator & {
  standalone?: boolean
}

export function detectAccessChannel(): SourceChannel {
  const liff = (window as LiffWindow).liff

  if (typeof liff?.isInClient === "function" && liff.isInClient()) {
    return "liff"
  }

  const standaloneNavigator = navigator as StandaloneNavigator

  if (
    window.matchMedia("(display-mode: standalone)").matches ||
    standaloneNavigator.standalone === true
  ) {
    return "pwa"
  }

  return "web"
}
