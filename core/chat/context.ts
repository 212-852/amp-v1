import type { Session, SessionRole } from "@/core/auth/types"
import {
  type ChatContext,
  type ChatIncomingInput,
  type ChatLocale,
  type ChatModeSwitchInput,
  type ChatParticipantRole,
  type ChatTypingInput,
  SUPPORTED_CHAT_LOCALES,
} from "@/core/chat/types"

function normalizeLocale(value: string | null | undefined): ChatLocale {
  const normalized = value?.trim().toLowerCase()

  if (normalized === "en" || normalized === "es") {
    return normalized
  }

  return "ja"
}

export function resolveParticipantRole(session_role: SessionRole): ChatParticipantRole {
  if (session_role === "admin") {
    return "admin"
  }

  if (session_role === "driver") {
    return "driver"
  }

  if (session_role === "user") {
    return "user"
  }

  return "guest"
}

export function resolveChatLocale(
  preferred: string | null | undefined,
  room_locale?: ChatLocale | null,
): ChatLocale {
  if (room_locale && SUPPORTED_CHAT_LOCALES.includes(room_locale)) {
    return room_locale
  }

  return normalizeLocale(preferred)
}

export function buildChatContext(
  session: Session,
  input: {
    source_channel: ChatIncomingInput["source_channel"]
    locale?: string | null
    participant_uuid?: string | null
    room_uuid?: string | null
  },
): ChatContext {
  return {
    source_channel: input.source_channel,
    locale: resolveChatLocale(input.locale, null),
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    session_role: session.role,
    display_name: session.display_name,
    participant_uuid: input.participant_uuid ?? null,
    room_uuid: input.room_uuid ?? null,
  }
}

export function normalizeIncomingChatInput(input: ChatIncomingInput): ChatContext {
  return buildChatContext(input.session, {
    source_channel: input.source_channel,
    locale: input.locale,
    participant_uuid: input.participant_uuid,
    room_uuid: input.room_uuid,
  })
}

export function normalizeModeSwitchInput(input: ChatModeSwitchInput): ChatContext {
  return buildChatContext(input.session, {
    source_channel: input.source_channel,
    locale: input.locale,
    participant_uuid: input.participant_uuid,
    room_uuid: input.room_uuid,
  })
}

export function normalizeTypingInput(input: ChatTypingInput): ChatContext {
  return buildChatContext(input.session, {
    source_channel: input.source_channel,
    locale: input.locale,
    participant_uuid: input.participant_uuid,
    room_uuid: input.room_uuid,
  })
}

export function resolveParticipantDisplayName(
  session: Session,
  role: ChatParticipantRole,
) {
  if (session.display_name?.trim()) {
    return session.display_name.trim()
  }

  if (role === "guest") {
    return "Guest"
  }

  return session.role
}
