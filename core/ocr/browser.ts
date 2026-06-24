type LiffOpenWindow = {
  liff?: {
    openWindow?: (input: { url: string; external?: boolean }) => void
  }
}

export type ExternalBrowserOpenResult = {
  opened: boolean
  method: "liff" | "window_open" | "manual"
}

export function open_current_url_in_external_browser(): ExternalBrowserOpenResult {
  if (typeof window === "undefined") {
    return { opened: false, method: "manual" }
  }

  const url = window.location.href
  const liff = (window as LiffOpenWindow).liff

  if (liff?.openWindow) {
    try {
      liff.openWindow({ url, external: true })
      return { opened: true, method: "liff" }
    } catch {
      // Fall through to window.open.
    }
  }

  const opened_window = window.open(url, "_blank", "noopener,noreferrer")

  if (opened_window) {
    return { opened: true, method: "window_open" }
  }

  return { opened: false, method: "manual" }
}
