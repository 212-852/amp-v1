export const PWA_OFFLINE_EVENT = "amp-pwa-offline"
export const PWA_ONLINE_EVENT = "amp-pwa-online"

export function dispatchPwaOffline() {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent(PWA_OFFLINE_EVENT))
}

export function dispatchPwaOnline() {
  if (typeof window === "undefined") {
    return
  }

  window.dispatchEvent(new CustomEvent(PWA_ONLINE_EVENT))
}
