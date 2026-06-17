import type { Session } from "@/core/auth/types"
import {
  type ChatLocale,
  type ChatMessageKind,
  type ChatMessageType,
  type ChatRoomMode,
  type ChatTranslations,
  type TranslationStatus,
  CHAT_MESSAGE_TYPES,
} from "@/core/chat/types"

export const WELCOME_MESSAGES: Record<ChatLocale, string> = {
  ja: "こんにちは！PET TAXIへようこそ。ご用件をお知らせください。",
  en: "Hello! Welcome to PET TAXI. How can we help you today?",
  es: "Hola! Bienvenido a PET TAXI. Como podemos ayudarte hoy?",
}

export const MODE_SWITCH_MESSAGES: Record<
  ChatRoomMode,
  Record<ChatLocale, string>
> = {
  bot: {
    ja: "Botモードに切り替えました。",
    en: "Switched to Bot mode.",
    es: "Cambiado al modo Bot.",
  },
  concierge: {
    ja: "Conciergeモードに切り替えました。",
    en: "Switched to Concierge mode.",
    es: "Cambiado al modo Concierge.",
  },
  group: {
    ja: "グループモードに切り替えました。",
    en: "Switched to Group mode.",
    es: "Cambiado al modo Group.",
  },
}

export const TYPING_LABELS: Record<ChatLocale, string> = {
  ja: "{name}が入力中",
  en: "{name} is typing",
  es: "{name} esta escribiendo",
}

export function resolveWelcomeMessage(locale: ChatLocale) {
  return WELCOME_MESSAGES[locale] ?? WELCOME_MESSAGES.ja
}

export function resolveModeSwitchMessage(mode: ChatRoomMode, locale: ChatLocale) {
  return MODE_SWITCH_MESSAGES[mode][locale] ?? MODE_SWITCH_MESSAGES[mode].ja
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

export function resolveArchivedMessageType(input: {
  kind: ChatMessageKind
  type?: ChatMessageType | null
}): ChatMessageType {
  if (input.type && isChatMessageType(input.type)) {
    if (input.type === "typing") {
      throw new Error("Typing messages must not be archived")
    }

    return input.type
  }

  if (input.kind === "system") {
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

export function resolveInitialRoomMode(session: Session): ChatRoomMode {
  void session
  return "bot"
}

export function buildLineFlexPayload(input: {
  body_display: string
  kind: ChatMessageKind
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
            color: input.kind === "system" ? "#8c7358" : "#3d2a19",
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
  kind: ChatMessageKind
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
    kind: input.kind,
    type: input.type,
    created_at: input.created_at,
  }
}
