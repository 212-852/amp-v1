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
}) {
  return `${input.room_uuid}:${input.trigger_message_uuid}:${input.selected_action}`
}

export function claim_chat_response(input: {
  room_uuid: string
  trigger_message_uuid: string
  selected_action: string
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
