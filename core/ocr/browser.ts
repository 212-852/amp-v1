export const DRIVER_PAGE_FALLBACK_URL = "https://app.da-nya.com/driver"

export function resolve_driver_page_url() {
  if (typeof window === "undefined") {
    return DRIVER_PAGE_FALLBACK_URL
  }

  return `${window.location.origin}/driver`
}

export function build_line_login_url(return_to = "/driver") {
  return `/api/auth/line/start?return_to=${encodeURIComponent(return_to)}`
}
