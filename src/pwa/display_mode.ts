export function is_pwa_display_mode() {
  if (typeof window === "undefined") {
    return false
  }

  const standalone_navigator = window.navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    standalone_navigator.standalone === true
  )
}

