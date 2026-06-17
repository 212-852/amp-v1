const DEDUP_TTL_MS = 60_000

const delivered_keys = new Map<string, number>()

function buildNotifyKey(
  request_id: string | null | undefined,
  event: string,
) {
  return `${request_id ?? "unknown"}:${event}`
}

function pruneDeliveredKeys(now: number) {
  for (const [key, timestamp] of delivered_keys.entries()) {
    if (now - timestamp >= DEDUP_TTL_MS) {
      delivered_keys.delete(key)
    }
  }
}

export function hasNotifyBeenDelivered(
  request_id: string | null | undefined,
  event: string,
) {
  const now = Date.now()
  pruneDeliveredKeys(now)

  const key = buildNotifyKey(request_id, event)
  const timestamp = delivered_keys.get(key)

  return Boolean(timestamp && now - timestamp < DEDUP_TTL_MS)
}

export function markNotifyDelivered(
  request_id: string | null | undefined,
  event: string,
) {
  const now = Date.now()
  pruneDeliveredKeys(now)
  delivered_keys.set(buildNotifyKey(request_id, event), now)
}
