export type PushSubscriptionJson = {
  endpoint?: string
  expirationTime?: number | null
  keys?: Record<string, string>
}

export function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }

  return output
}

async function resolveServiceWorkerRegistration() {
  if (!(await navigator.serviceWorker.getRegistration("/"))) {
    await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    })
  }

  return navigator.serviceWorker.ready
}

export async function acquireFreshPushSubscription(input: {
  public_key: string
}) {
  const registration = await resolveServiceWorkerRegistration()
  const existing = await registration.pushManager.getSubscription()

  if (existing) {
    await existing.unsubscribe()
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(input.public_key),
  })

  return subscription.toJSON() as PushSubscriptionJson
}
