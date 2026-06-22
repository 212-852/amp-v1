const OUTPUT_IDEMPOTENCY_TTL_MS = 5 * 60_000

const delivered_output_keys = new Map<string, number>()

function prune_output_idempotency(now: number) {
  for (const [key, created_at] of delivered_output_keys.entries()) {
    if (now - created_at > OUTPUT_IDEMPOTENCY_TTL_MS) {
      delivered_output_keys.delete(key)
    }
  }
}

export function build_output_idempotency_key(input: {
  room_uuid: string
  source_message_uuid: string
  selected_action?: string | null
  destination: string
}) {
  return [
    input.room_uuid,
    input.source_message_uuid,
    input.selected_action ?? "none",
    input.destination,
  ].join(":")
}

export function claim_output_delivery(key: string) {
  const now = Date.now()
  prune_output_idempotency(now)

  if (delivered_output_keys.has(key)) {
    return false
  }

  delivered_output_keys.set(key, now)
  return true
}

export function has_output_delivery(key: string) {
  const now = Date.now()
  prune_output_idempotency(now)
  return delivered_output_keys.has(key)
}
