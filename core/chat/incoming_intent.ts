import { normalize_chat_intent_text } from "@/core/chat/rules"
import type { ChatParticipantRole } from "@/core/chat/types"

const INCOMING_INTENT_TTL_MS = 10_000

const incoming_intent_claims = new Map<string, number>()

const BOT_FIXED_MESSAGE_BODIES = new Set([
  "welcome",
  "quick_menu",
  "partner_driver_recruit",
  "how_to_use",
  "faq",
  "bot_mode",
  "concierge_mode",
])

const ALLOWED_INCOMING_INTENT_ROLES = new Set<ChatParticipantRole>([
  "user",
  "guest",
])

function prune_incoming_intent_claims(now: number) {
  for (const [key, created_at] of incoming_intent_claims.entries()) {
    if (now - created_at > INCOMING_INTENT_TTL_MS) {
      incoming_intent_claims.delete(key)
    }
  }
}

export function build_incoming_intent_key(input: {
  room_uuid: string
  sender_key: string
  normalized_text: string
}) {
  return `${input.room_uuid}:${input.sender_key}:${input.normalized_text}`
}

export function claim_incoming_intent(input: {
  room_uuid: string
  sender_key: string
  normalized_text: string
}) {
  const key = build_incoming_intent_key(input)
  const now = Date.now()
  prune_incoming_intent_claims(now)

  const existing = incoming_intent_claims.get(key)

  if (existing && now - existing < INCOMING_INTENT_TTL_MS) {
    return false
  }

  incoming_intent_claims.set(key, now)
  return true
}

export function can_process_incoming_chat_intent(input: {
  body: string
  participant_role: ChatParticipantRole
  source_kind?: string | null
}) {
  if (!ALLOWED_INCOMING_INTENT_ROLES.has(input.participant_role)) {
    return {
      allowed: false,
      blocked_reason: "sender_role_not_allowed",
    } as const
  }

  if (
    input.source_kind === "bot" ||
    input.source_kind === "system" ||
    input.source_kind === "concierge"
  ) {
    return {
      allowed: false,
      blocked_reason: "source_kind_not_allowed",
    } as const
  }

  if (BOT_FIXED_MESSAGE_BODIES.has(input.body.trim())) {
    return {
      allowed: false,
      blocked_reason: "bot_fixed_message_body",
    } as const
  }

  return {
    allowed: true,
    blocked_reason: null,
  } as const
}

export function normalize_incoming_intent_text(text: string) {
  return normalize_chat_intent_text(text)
}
