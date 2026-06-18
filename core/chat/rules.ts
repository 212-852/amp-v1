import type { Session } from "@/core/auth/types"
import { isCarouselPayload } from "@/core/bot/rules"
import {
  countRoomMessages,
  roomHasWelcomeMessage,
} from "@/core/chat/archive"
import {
  type ChatLocale,
  type ChatMessageKind,
  type ChatMessageMeta,
  type ChatMessagePayload,
  type ChatMessageRecord,
  type ChatMessageType,
  type ChatRoomMode,
  type ChatTranslations,
  type TranslationStatus,
  CHAT_MESSAGE_TYPES,
} from "@/core/chat/types"

export const TYPING_LABELS: Record<ChatLocale, string> = {
  ja: "{name}が入力中",
  en: "{name} is typing",
  es: "{name} esta escribiendo",
}

export function resolveTypingLabel(locale: ChatLocale, name: string) {
  return (TYPING_LABELS[locale] ?? TYPING_LABELS.ja).replace("{name}", name)
}

export function isChatMessageType(value: string): value is ChatMessageType {
  return CHAT_MESSAGE_TYPES.includes(value as ChatMessageType)
}

export function assertChatMessageType(value: string): ChatMessageType {
  if (!isChatMessageType(value)) {
    throw new Error(`Invalid message type: ${value}`)
  }

  return value
}

export function readMessageMeta(
  payload: ChatMessagePayload | null | undefined,
): ChatMessageMeta {
  const meta = payload?.meta

  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {}
  }

  return meta
}

export function readMessageSourceKind(
  message: ChatMessageRecord,
  fallback: ChatMessageKind = "user",
): ChatMessageKind {
  if (isCarouselPayload(message.payload)) {
    return "bot"
  }

  if (message.body === "welcome" || message.body === "quick_menu") {
    return "bot"
  }

  const kind = readMessageMeta(message.payload).source_kind

  if (
    kind === "user" ||
    kind === "system" ||
    kind === "bot" ||
    kind === "concierge"
  ) {
    return kind
  }

  if (message.type === "system") {
    return "system"
  }

  return fallback
}

export function resolveMessageOriginalLocale(
  message: ChatMessageRecord,
  room_locale: ChatLocale,
): ChatLocale {
  return readMessageMeta(message.payload).original_locale ?? room_locale
}

export function resolveMessageDisplayLocale(
  message: ChatMessageRecord,
  room_locale: ChatLocale,
): ChatLocale {
  return readMessageMeta(message.payload).display_locale ?? room_locale
}

export function resolveMessageTranslations(
  message: ChatMessageRecord,
): ChatTranslations {
  return readMessageMeta(message.payload).translations ?? {}
}

export function resolveMessageBodyOriginal(message: ChatMessageRecord) {
  return message.body
}

export function resolveMessageBodyDisplay(
  message: ChatMessageRecord,
  room_locale: ChatLocale,
) {
  const meta = readMessageMeta(message.payload)
  const translations = meta.translations ?? {}
  const display_locale = meta.display_locale ?? room_locale
  const original_locale = meta.original_locale ?? room_locale

  if (original_locale === display_locale) {
    return message.body
  }

  return translations[display_locale] ?? message.body
}

export function hasMessageTranslation(
  message: ChatMessageRecord,
  room_locale: ChatLocale,
) {
  const meta = readMessageMeta(message.payload)
  const translations = meta.translations ?? {}
  const display_locale = meta.display_locale ?? room_locale
  const original_locale = meta.original_locale ?? room_locale

  return (
    original_locale !== display_locale ||
    Object.keys(translations).length > 0 ||
    resolveMessageBodyDisplay(message, room_locale) !== message.body
  )
}

export function resolveArchivedMessageType(input: {
  source_kind: ChatMessageKind
  type?: ChatMessageType | null
}): ChatMessageType {
  if (input.type && isChatMessageType(input.type)) {
    if (input.type === "typing") {
      throw new Error("Typing messages must not be archived")
    }

    return input.type
  }

  if (input.source_kind === "system") {
    return "system"
  }

  return "text"
}

export function shouldTranslateMessage(
  original_locale: ChatLocale,
  room_locale: ChatLocale,
) {
  return original_locale !== room_locale
}

export function resolveDisplayFields(input: {
  body_original: string
  original_locale: ChatLocale
  room_locale: ChatLocale
  translations: ChatTranslations
}) {
  const needs_translation = shouldTranslateMessage(
    input.original_locale,
    input.room_locale,
  )

  if (!needs_translation) {
    return {
      body_display: input.body_original,
      display_locale: input.original_locale,
      translation_status: "none" as TranslationStatus,
    }
  }

  const translated = input.translations[input.room_locale]

  if (translated) {
    return {
      body_display: translated,
      display_locale: input.room_locale,
      translation_status: "complete" as TranslationStatus,
    }
  }

  return {
    body_display: input.body_original,
    display_locale: input.original_locale,
    translation_status: "pending" as TranslationStatus,
  }
}

export function assertMessageBody(body: string) {
  const normalized = body.trim()

  if (!normalized) {
    throw new Error("Message body is required")
  }

  if (normalized.length > 4000) {
    throw new Error("Message body is too long")
  }

  return normalized
}

export function assertRoomMode(mode: string): ChatRoomMode {
  if (mode === "bot" || mode === "concierge" || mode === "group") {
    return mode
  }

  throw new Error(`Invalid room mode: ${mode}`)
}

export function resolve_room_mode_trigger(text: string): "bot" | "concierge" | null {
  const trimmed = text.trim()

  if (!trimmed) {
    return null
  }

  const normalized = trimmed.toLowerCase().replace(/\s+/g, "")

  if (normalized === "bot") {
    return "bot"
  }

  if (normalized === "concierge") {
    return "concierge"
  }

  if (trimmed === "ボット") {
    return "bot"
  }

  if (trimmed === "コンシェルジュ") {
    return "concierge"
  }

  return null
}

export const resolve_room_mode_command = resolve_room_mode_trigger

export function resolveRoomModeCommandReply(mode: ChatRoomMode) {
  if (mode === "bot") {
    return "Bot mode enabled."
  }

  if (mode === "concierge") {
    return "Concierge mode enabled."
  }

  return resolveModeChangeSystemMessage(mode)
}

export function resolveModeChangeSystemMessage(mode: ChatRoomMode) {
  if (mode === "group") {
    return "Group support started"
  }

  if (mode === "bot") {
    return "Bot mode enabled."
  }

  if (mode === "concierge") {
    return "Concierge mode enabled."
  }

  return `Room mode changed to ${mode}`
}

export function resolveInitialRoomMode(session: Session): ChatRoomMode {
  void session
  return "bot"
}

export function buildLineFlexPayload(input: {
  body_display: string
  source_kind: ChatMessageKind
}) {
  return {
    type: "flex",
    altText: input.body_display,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: input.body_display,
            wrap: true,
            size: "md",
            color: input.source_kind === "system" ? "#8c7358" : "#3d2a19",
          },
        ],
      },
    },
  }
}

export function buildWebMessagePayload(input: {
  message_uuid: string
  body_display: string
  body_original: string
  display_locale: ChatLocale
  original_locale: ChatLocale
  translations: ChatTranslations
  source_kind: ChatMessageKind
  type: ChatMessageType
  created_at: string
}) {
  return {
    message_uuid: input.message_uuid,
    body_display: input.body_display,
    body_original: input.body_original,
    display_locale: input.display_locale,
    original_locale: input.original_locale,
    translations: input.translations,
    source_kind: input.source_kind,
    type: input.type,
    created_at: input.created_at,
  }
}

export function buildMessagePayload(input: {
  message_uuid: string
  body_display: string
  body_original: string
  display_locale: ChatLocale
  original_locale: ChatLocale
  translations: ChatTranslations
  translation_status: TranslationStatus
  source_kind: ChatMessageKind
  type: ChatMessageType
  created_at: string
  existing_payload?: Record<string, unknown> | null
}): ChatMessagePayload {
  const existing = input.existing_payload ?? {}
  const existing_web =
    existing.web &&
    typeof existing.web === "object" &&
    !Array.isArray(existing.web)
      ? (existing.web as Record<string, unknown>)
      : {}
  const existing_line = existing.line
  const existing_meta =
    existing.meta &&
    typeof existing.meta === "object" &&
    !Array.isArray(existing.meta)
      ? (existing.meta as Record<string, unknown>)
      : {}

  return {
    ...existing,
    web: {
      ...existing_web,
      ...buildWebMessagePayload({
        message_uuid: input.message_uuid,
        body_display: input.body_display,
        body_original: input.body_original,
        display_locale: input.display_locale,
        original_locale: input.original_locale,
        translations: input.translations,
        source_kind: input.source_kind,
        type: input.type,
        created_at: input.created_at,
      }),
    },
    line: (existing_line as Record<string, unknown> | undefined) ??
      buildLineFlexPayload({
        body_display: input.body_display,
        source_kind: input.source_kind,
      }),
    meta: {
      ...existing_meta,
      original_locale: input.original_locale,
      display_locale: input.display_locale,
      translations: input.translations,
      translation_status: input.translation_status,
      source_kind: input.source_kind,
    },
  }
}

export async function shouldBootstrapWelcome(room_uuid: string) {
  if (await roomHasWelcomeMessage(room_uuid)) {
    return false
  }

  if ((await countRoomMessages(room_uuid)) > 0) {
    return false
  }

  return true
}
