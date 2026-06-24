export const DRIVER_PAGE_FALLBACK_URL = "https://app.da-nya.com/driver"

export function is_line_in_app_browser(user_agent?: string | null) {
  const value =
    user_agent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "")

  return value.toLowerCase().includes("line")
}

type LiffWindow = Window & {
  liff?: {
    isInClient?: () => boolean
  }
}

type StandaloneNavigator = Navigator & {
  standalone?: boolean
}

export function is_liff_in_app_browser() {
  if (typeof window === "undefined") {
    return false
  }

  const liff = (window as LiffWindow).liff

  if (typeof liff?.isInClient === "function" && liff.isInClient()) {
    return true
  }

  const params = new URLSearchParams(window.location.search)

  return (
    params.get("source_channel") === "liff" ||
    params.has("liff") ||
    params.has("liff_state") ||
    window.location.hostname === "liff.line.me"
  )
}

export function is_pwa_display_mode() {
  if (typeof window === "undefined") {
    return false
  }

  const standalone_navigator = navigator as StandaloneNavigator

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    standalone_navigator.standalone === true
  )
}

export function is_supported_camera_browser(user_agent?: string | null) {
  const value =
    user_agent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "")
  const normalized = value.toLowerCase()

  if (is_pwa_display_mode()) {
    return true
  }

  const is_chrome =
    normalized.includes("chrome") ||
    normalized.includes("crios") ||
    normalized.includes("chromium")
  const is_safari =
    normalized.includes("safari") &&
    !normalized.includes("chrome") &&
    !normalized.includes("crios") &&
    !normalized.includes("chromium") &&
    !normalized.includes("android")

  return is_chrome || is_safari
}

export function is_camera_api_available() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  )
}

export function should_use_upload_only_for_ocr(user_agent?: string | null) {
  return is_line_in_app_browser(user_agent) || is_liff_in_app_browser()
}

export function should_auto_start_ocr_camera(user_agent?: string | null) {
  return (
    !should_use_upload_only_for_ocr(user_agent) &&
    is_supported_camera_browser(user_agent) &&
    is_camera_api_available()
  )
}

export function resolve_driver_page_url() {
  return DRIVER_PAGE_FALLBACK_URL
}

export function build_line_login_url(return_to = "/driver") {
  return `/api/auth/line/start?return_to=${encodeURIComponent(return_to)}`
}
