import type { Session, SessionRole, SourceChannel } from "@/core/auth/types"

export type ChatRoomMode = "bot" | "concierge" | "group"

export type ChatParticipantRole =
  | "guest"
  | "user"
  | "admin"
  | "driver"
  | "concierge"
  | "bot"

export type ChatMessageKind = "user" | "system" | "bot" | "concierge"

export type ChatMessageType =
  | "text"
  | "image"
  | "file"
  | "location"
  | "flex"
  | "system"
  | "typing"

export const CHAT_MESSAGE_TYPES: ChatMessageType[] = [
  "text",
  "image",
  "file",
  "location",
  "flex",
  "system",
  "typing",
]

export type ChatLocale = "ja" | "en" | "es"

export type TranslationStatus = "none" | "pending" | "complete" | "failed"

export type ChatTranslations = Partial<Record<ChatLocale, string>>

export type ChatRoomRecord = {
  room_uuid: string
  mode: ChatRoomMode
  locale: ChatLocale
  channel: SourceChannel
  owner_visitor_uuid: string | null
  owner_user_uuid: string | null
  created_at: string
  updated_at: string
}

export type ChatRoomBootstrapResult = {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  created: boolean
  participant_created: boolean
}

export type ChatParticipantRecord = {
  participant_uuid: string
  room_uuid: string
  role: ChatParticipantRole
  visitor_uuid: string | null
  user_uuid: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export type ChatMessageRecord = {
  message_uuid: string
  room_uuid: string
  participant_uuid: string | null
  source_channel: SourceChannel
  kind: ChatMessageKind
  type: ChatMessageType
  body_original: string
  original_locale: ChatLocale
  body_display: string
  display_locale: ChatLocale
  translations: ChatTranslations
  translation_status: TranslationStatus
  payload: Record<string, unknown> | null
  created_at: string
}

export type ChatTypingRecord = {
  room_uuid: string
  participant_uuid: string
  display_name: string
  locale: ChatLocale
  updated_at: string
}

export type ChatContext = {
  source_channel: SourceChannel
  locale: ChatLocale
  visitor_uuid: string | null
  user_uuid: string | null
  session_role: SessionRole
  display_name: string | null
  participant_uuid: string | null
  room_uuid: string | null
}

export type ChatIncomingInput = {
  body: string
  source_channel: SourceChannel
  locale?: string | null
  session: Session
  participant_uuid?: string | null
  room_uuid?: string | null
}

export type ChatModeSwitchInput = {
  mode: ChatRoomMode
  source_channel: SourceChannel
  locale?: string | null
  session: Session
  participant_uuid?: string | null
  room_uuid?: string | null
}

export type ChatTypingInput = {
  is_typing: boolean
  source_channel: SourceChannel
  locale?: string | null
  session: Session
  participant_uuid?: string | null
  room_uuid?: string | null
}

export type MessageBundle = {
  message_uuid: string
  room_uuid: string
  kind: ChatMessageKind
  type: ChatMessageType
  source_channel: SourceChannel
  body_display: string
  body_original: string
  display_locale: ChatLocale
  original_locale: ChatLocale
  translations: ChatTranslations
  payload: Record<string, unknown> | null
  created_at: string
}

export type ChatRoomState = {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  messages: ChatMessageRecord[]
  typing: ChatTypingRecord[]
  concierge_available: boolean
}

export const TYPING_TIMEOUT_MS = 5000

export const SUPPORTED_CHAT_LOCALES: ChatLocale[] = ["ja", "en", "es"]
