import type { Session, SessionRole, SourceChannel } from "@/core/auth/types"

export type ChatRoomMode = "bot" | "concierge" | "group"

export type BotMessageKey =
  | "welcome"
  | "quick_menu"
  | "bot_mode"
  | "concierge_mode"
  | "how_to_use"
  | "faq"

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

export type ChatMessageStatus = "sent" | "failed"

export type ChatLocale = "ja" | "en" | "es"

export type TranslationStatus = "none" | "pending" | "complete" | "failed"

export type ChatTranslations = Partial<Record<ChatLocale, string>>

export type ChatMessageMeta = {
  original_locale?: ChatLocale
  display_locale?: ChatLocale
  translations?: ChatTranslations
  translation_status?: TranslationStatus
  source_kind?: ChatMessageKind
  bot_key?: BotMessageKey
  presence_action?: "enter" | "leave"
  actor_role?: ChatParticipantRole
}

export type ChatMessagePayload = {
  type?: "carousel"
  contents?: Record<string, unknown>[]
  web?: Record<string, unknown>
  line?: Record<string, unknown>
  meta?: ChatMessageMeta
}

export type ChatRoomRecord = {
  room_uuid: string
  room_key?: string | null
  mode: ChatRoomMode
  locale: ChatLocale
  channel: SourceChannel
  thread_id?: string | null
  thread_status?: "open" | "closed" | null
  user_uuid?: string | null
  visitor_uuid?: string | null
  order_uuid?: string | null
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
  user_uuid: string | null
  visitor_uuid: string | null
  role: ChatParticipantRole
  joined_at: string
}

export type ChatMessageRecord = {
  message_uuid: string
  room_uuid: string
  participant_uuid: string | null
  message_kind?: string | null
  type: ChatMessageType
  status: ChatMessageStatus
  body: string
  payload: ChatMessagePayload | null
  source_channel?: SourceChannel | null
  external_id?: string | null
  created_at: string
}

export type ChatTypingRecord = {
  room_uuid: string
  participant_uuid: string
  display_name: string
  locale: ChatLocale
}

export type RealtimeTypingEvent = "typing_start" | "typing_stop"

export type PresenceStatus = "entered" | "left"

export type PresenceRecord = {
  room_uuid: string
  participant_uuid: string
  status: PresenceStatus
  entered_at: string
  left_at: string | null
  last_seen_at: string
  updated_at: string
}

export type PresenceView = PresenceRecord & {
  display_name: string
  role: ChatParticipantRole
}

export type ChatRoomPresenceInput = {
  room_uuid: string
  action: "enter" | "leave"
  source_channel: SourceChannel
  locale?: string | null
  session: Session
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
  external_id?: string | null
  line_reply_token?: string | null
  line_provider_user_id?: string | null
  line_reply_allowed?: boolean
}

export type ChatModeSwitchInput = {
  mode: ChatRoomMode
  source_channel: SourceChannel
  locale?: string | null
  session: Session
  participant_uuid?: string | null
  room_uuid?: string | null
  line_reply_token?: string | null
  line_provider_user_id?: string | null
  line_reply_allowed?: boolean
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
  type: ChatMessageType
  status: ChatMessageStatus
  body: string
  body_display: string
  body_original: string
  display_locale: ChatLocale
  original_locale: ChatLocale
  translations: ChatTranslations
  source_kind: ChatMessageKind
  payload: ChatMessagePayload | null
  created_at: string
}

export type AvailabilityRecord = {
  user_uuid: string
  enabled: boolean
  updated_at: string
}

export type ChatRoomState = {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  messages: ChatMessageRecord[]
  presence: PresenceView[]
  concierge_available: boolean
}

export const TYPING_TIMEOUT_MS = 5000

export const SUPPORTED_CHAT_LOCALES: ChatLocale[] = ["ja", "en", "es"]
