const DEDUP_TTL_MS = 60_000

const recorded_keys = new Map<string, number>()

function buildAccessKey(
  request_id: string | null | undefined,
  event: string,
) {
  return `${request_id ?? "unknown"}:${event}`
}

function pruneRecordedKeys(now: number) {
  for (const [key, timestamp] of recorded_keys.entries()) {
    if (now - timestamp >= DEDUP_TTL_MS) {
      recorded_keys.delete(key)
    }
  }
}

export function hasAccessEventBeenRecorded(
  request_id: string | null | undefined,
  event: string,
) {
  const now = Date.now()
  pruneRecordedKeys(now)

  const key = buildAccessKey(request_id, event)
  const timestamp = recorded_keys.get(key)

  return Boolean(timestamp && now - timestamp < DEDUP_TTL_MS)
}

export function markAccessEventRecorded(
  request_id: string | null | undefined,
  event: string,
) {
  const now = Date.now()
  pruneRecordedKeys(now)
  recorded_keys.set(buildAccessKey(request_id, event), now)
}
