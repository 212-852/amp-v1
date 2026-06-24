export const DRIVER_PAGE_FALLBACK_URL = "https://app.da-nya.com/driver"

export function is_line_in_app_browser(user_agent?: string | null) {
  const value =
    user_agent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "")

  return value.toLowerCase().includes("line")
}

export function is_pwa_display_mode() {
  if (typeof window === "undefined") {
    return false
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  )
}

export function should_auto_start_ocr_camera(user_agent?: string | null) {
  return !is_line_in_app_browser(user_agent)
}

export function resolve_driver_page_url() {
  if (typeof window === "undefined") {
    return DRIVER_PAGE_FALLBACK_URL
  }

  return `${window.location.origin}/driver`
}

export function build_line_login_url(return_to = "/driver") {
  return `/api/auth/line/start?return_to=${encodeURIComponent(return_to)}`
}
