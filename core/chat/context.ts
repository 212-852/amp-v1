import type { Session, SessionRole } from "@/core/auth/types"
import { sendAuthDebug } from "@/core/debug"
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

function isSupportedLocale(value: string | null | undefined): value is ChatLocale {
  const normalized = value?.trim().toLowerCase()
  return normalized === "ja" || normalized === "en" || normalized === "es"
}

export type LocaleSource =
  | "explicit"
  | "session_locale"
  | "user_locale"
  | "room_locale"
  | "browser_locale"
  | "fallback"

export function resolveOutputLocaleDecision(input: {
  preferred?: string | null
  session_locale?: string | null
  user_locale?: string | null
  room_locale?: ChatLocale | null
  browser_locale?: string | null
}): { final_locale: ChatLocale; source: LocaleSource } {
  if (isSupportedLocale(input.preferred)) {
    return { final_locale: normalizeLocale(input.preferred), source: "explicit" }
  }

  if (isSupportedLocale(input.session_locale)) {
    return {
      final_locale: normalizeLocale(input.session_locale),
      source: "session_locale",
    }
  }

  if (isSupportedLocale(input.user_locale)) {
    return {
      final_locale: normalizeLocale(input.user_locale),
      source: "user_locale",
    }
  }

  if (input.room_locale && SUPPORTED_CHAT_LOCALES.includes(input.room_locale)) {
    return { final_locale: input.room_locale, source: "room_locale" }
  }

  if (isSupportedLocale(input.browser_locale)) {
    return {
      final_locale: normalizeLocale(input.browser_locale),
      source: "browser_locale",
    }
  }

  return { final_locale: "ja", source: "fallback" }
}

export function resolveOutputLocale(input: {
  preferred?: string | null
  session_locale?: string | null
  user_locale?: string | null
  room_locale?: ChatLocale | null
  browser_locale?: string | null
}): ChatLocale {
  return resolveOutputLocaleDecision(input).final_locale
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
  session_locale?: string | null,
  browser_locale?: string | null,
): ChatLocale {
  return resolveOutputLocale({
    preferred,
    session_locale,
    room_locale,
    browser_locale,
  })
}

export function buildChatContext(
  session: Session,
  input: {
    source_channel: ChatIncomingInput["source_channel"]
    locale?: string | null
    session_locale?: string | null
    user_locale?: string | null
    browser_locale?: string | null
    room_locale?: ChatLocale | null
    participant_uuid?: string | null
    room_uuid?: string | null
  },
): ChatContext {
  const locale_decision = resolveOutputLocaleDecision({
    preferred: input.locale,
    session_locale: input.session_locale,
    user_locale: input.user_locale,
    room_locale: input.room_locale ?? null,
    browser_locale: input.browser_locale,
  })

  void sendAuthDebug("chat_context_locale_resolved", {
    final_locale: locale_decision.final_locale,
    source: locale_decision.source,
    user_uuid: session.user_uuid,
    visitor_uuid: session.visitor_uuid,
    room_uuid: input.room_uuid ?? null,
    room_locale: input.room_locale ?? null,
    source_channel: input.source_channel,
  })

  return {
    source_channel: input.source_channel,
    locale: locale_decision.final_locale,
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
