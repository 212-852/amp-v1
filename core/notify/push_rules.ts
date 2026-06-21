export type PushSubscriptionContext = {
  endpoint: string
  p256dh: string | null
  auth: string | null
  user_agent: string | null
}

export function resolvePushPublicKey() {
  return (
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    process.env.VAPID_PUBLIC_KEY ??
    ""
  ).trim()
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function normalizePushSubscription(
  value: unknown,
  user_agent: string | null,
): PushSubscriptionContext {
  if (!value || typeof value !== "object") {
    throw new Error("push_subscription_required")
  }

  const record = value as {
    endpoint?: unknown
    keys?: {
      p256dh?: unknown
      auth?: unknown
    }
  }
  const endpoint = normalizeString(record.endpoint)

  if (!endpoint) {
    throw new Error("push_subscription_endpoint_required")
  }

  return {
    endpoint,
    p256dh: normalizeString(record.keys?.p256dh),
    auth: normalizeString(record.keys?.auth),
    user_agent,
  }
}

