import type {
  ChatMessageType,
  ChatParticipantRole,
} from "@/core/chat/types"

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

const ALLOWED_INCOMING_SOURCE_EVENTS = new Set([
  "user_submit",
  "line_webhook",
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
  sender_role: ChatParticipantRole
  direction?: string | null
  source_event?: string | null
  message_type?: ChatMessageType | string | null
  source_kind?: string | null
}) {
  if (!ALLOWED_INCOMING_INTENT_ROLES.has(input.sender_role)) {
    return {
      allowed: false,
      blocked_reason: "sender_role_not_allowed",
    } as const
  }

  if (input.direction !== "incoming") {
    return {
      allowed: false,
      blocked_reason: "direction_not_incoming",
    } as const
  }

  if (
    !input.source_event ||
    !ALLOWED_INCOMING_SOURCE_EVENTS.has(input.source_event)
  ) {
    return {
      allowed: false,
      blocked_reason: "source_event_not_allowed",
    } as const
  }

  if (input.message_type === "flex") {
    return {
      allowed: false,
      blocked_reason: "flex_message_not_allowed",
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
  return text.normalize("NFKC").trim().replace(/\s+/g, "").toLowerCase()
}
