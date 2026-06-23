const OUTPUT_IDEMPOTENCY_TTL_MS = 5 * 60_000

export type OutputDeliveryState =
  | "pending"
  | "sending"
  | "sent"
  | "skipped"
  | "failed_final"

type OutputDeliveryRecord = {
  state: OutputDeliveryState
  updated_at: number
}

const output_delivery_registry = new Map<string, OutputDeliveryRecord>()

const TERMINAL_OUTPUT_STATES = new Set<OutputDeliveryState>([
  "sent",
  "skipped",
  "failed_final",
])

const DUPLICATE_OUTPUT_STATES = new Set<OutputDeliveryState>([
  "sending",
  "sent",
  "skipped",
  "failed_final",
])

function prune_output_idempotency(now: number) {
  for (const [key, record] of output_delivery_registry.entries()) {
    if (now - record.updated_at > OUTPUT_IDEMPOTENCY_TTL_MS) {
      output_delivery_registry.delete(key)
    }
  }
}

export function build_output_idempotency_key(input: {
  room_uuid: string
  source_message_uuid?: string | null
  source_event_uuid?: string | null
  normalized_text?: string | null
  selected_action?: string | null
  destination: string
}) {
  const minute_bucket = Math.floor(Date.now() / 60_000).toString()
  const semantic_source_key = input.source_event_uuid?.trim()
    ? `event:${input.source_event_uuid.trim()}`
    : input.normalized_text?.trim()
      ? `text:${input.normalized_text.trim()}:${minute_bucket}`
      : `message:${input.source_message_uuid ?? "unknown"}`

  return [
    input.room_uuid,
    semantic_source_key,
    input.selected_action ?? "none",
    input.destination,
  ].join(":")
}

export function build_output_semantic_source_key(input: {
  source_message_uuid?: string | null
  source_event_uuid?: string | null
  normalized_text?: string | null
}) {
  const minute_bucket = Math.floor(Date.now() / 60_000).toString()

  if (input.source_event_uuid?.trim()) {
    return `event:${input.source_event_uuid.trim()}`
  }

  if (input.normalized_text?.trim()) {
    return `text:${input.normalized_text.trim()}:${minute_bucket}`
  }

  return `message:${input.source_message_uuid ?? "unknown"}`
}

export function inspect_output_delivery_state(
  key: string,
): OutputDeliveryState | null {
  const now = Date.now()
  prune_output_idempotency(now)
  return output_delivery_registry.get(key)?.state ?? null
}

export function begin_output_delivery(key: string):
  | {
      ok: true
      state: "sending"
    }
  | {
      ok: false
      existing_state: OutputDeliveryState
    } {
  const now = Date.now()
  prune_output_idempotency(now)

  const existing = output_delivery_registry.get(key)

  if (existing && DUPLICATE_OUTPUT_STATES.has(existing.state)) {
    return {
      ok: false,
      existing_state: existing.state,
    }
  }

  output_delivery_registry.set(key, {
    state: "sending",
    updated_at: now,
  })

  return {
    ok: true,
    state: "sending",
  }
}

export function complete_output_delivery(
  key: string,
  state: Extract<OutputDeliveryState, "sent" | "skipped" | "failed_final">,
) {
  const now = Date.now()
  prune_output_idempotency(now)

  output_delivery_registry.set(key, {
    state,
    updated_at: now,
  })
}

/** @deprecated Use begin_output_delivery + complete_output_delivery */
export function claim_output_delivery(key: string) {
  return begin_output_delivery(key).ok
}

/** @deprecated Use inspect_output_delivery_state */
export function has_output_delivery(key: string) {
  const state = inspect_output_delivery_state(key)
  return Boolean(state && TERMINAL_OUTPUT_STATES.has(state))
}
