const CHAT_RESPONSE_CLAIM_TTL_MS = 60_000

const chat_response_claims = new Map<string, number>()

function prune_chat_response_claims(now: number) {
  for (const [key, created_at] of chat_response_claims.entries()) {
    if (now - created_at > CHAT_RESPONSE_CLAIM_TTL_MS) {
      chat_response_claims.delete(key)
    }
  }
}

export function build_chat_response_claim_key(input: {
  room_uuid: string
  trigger_message_uuid: string
  selected_action: string
  source_event_uuid?: string | null
  normalized_text?: string | null
}) {
  const minute_bucket = Math.floor(Date.now() / 60_000).toString()
  const semantic_source_key = input.source_event_uuid?.trim()
    ? `event:${input.source_event_uuid.trim()}`
    : input.normalized_text?.trim()
      ? `text:${input.normalized_text.trim()}:${minute_bucket}`
      : `message:${input.trigger_message_uuid}`

  return `${input.room_uuid}:${semantic_source_key}:${input.selected_action}`
}

export function claim_chat_response(input: {
  room_uuid: string
  trigger_message_uuid: string
  selected_action: string
  source_event_uuid?: string | null
  normalized_text?: string | null
}) {
  const key = build_chat_response_claim_key(input)
  const now = Date.now()
  prune_chat_response_claims(now)

  const existing = chat_response_claims.get(key)

  if (existing && now - existing < CHAT_RESPONSE_CLAIM_TTL_MS) {
    return false
  }

  chat_response_claims.set(key, now)
  return true
}
