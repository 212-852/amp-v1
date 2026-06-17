import {
  insertMessage,
  loadBotMessage,
  loadRoomMessages,
} from "@/core/chat/archive"
import {
  buildMessagePayload,
  readMessageSourceKind,
  resolveArchivedMessageType,
  resolveDisplayFields,
  resolveMessageBodyDisplay,
  resolveMessageDisplayLocale,
  resolveMessageOriginalLocale,
  resolveMessageTranslations,
} from "@/core/chat/rules"
import { ensureRoomLocaleTranslation } from "@/core/chat/translate"
import type {
  BotMessageKey,
  ChatLocale,
  ChatMessageKind,
  ChatMessageRecord,
  ChatMessageType,
  ChatParticipantRecord,
  ChatRoomRecord,
  ChatTranslations,
  MessageBundle,
} from "@/core/chat/types"
import type { Session, SourceChannel } from "@/core/auth/types"
import { deliverOutput } from "@/core/output"
import { randomUUID } from "crypto"

export type PreparedMessageInput = {
  room: ChatRoomRecord
  participant: ChatParticipantRecord | null
  source_channel: SourceChannel
  source_kind: ChatMessageKind
  type?: ChatMessageType
  body: string
  original_locale: ChatLocale
  session: Session
  translations?: ChatTranslations
  payload?: Record<string, unknown> | null
}

export function toMessageBundle(
  message: ChatMessageRecord,
  room_locale: ChatLocale,
): MessageBundle {
  const source_kind = readMessageSourceKind(message)
  const original_locale = resolveMessageOriginalLocale(message, room_locale)
  const display_locale = resolveMessageDisplayLocale(message, room_locale)
  const translations = resolveMessageTranslations(message)

  return {
    message_uuid: message.message_uuid,
    room_uuid: message.room_uuid,
    type: message.type,
    status: message.status,
    body: message.body,
    body_display: resolveMessageBodyDisplay(message, room_locale),
    body_original: message.body,
    display_locale,
    original_locale,
    translations,
    source_kind,
    payload: message.payload,
    created_at: message.created_at,
  }
}

export async function archivePreparedMessage(input: PreparedMessageInput) {
  const translation = await ensureRoomLocaleTranslation({
    body_original: input.body,
    original_locale: input.original_locale,
    room_locale: input.room.locale,
    existing_translations: input.translations ?? {},
  })

  const display = resolveDisplayFields({
    body_original: input.body,
    original_locale: input.original_locale,
    room_locale: input.room.locale,
    translations: translation.translations,
  })

  const message_type = resolveArchivedMessageType({
    source_kind: input.source_kind,
    type: input.type,
  })
  const message_uuid = randomUUID()
  const created_at = new Date().toISOString()
  const payload = buildMessagePayload({
    message_uuid,
    body_display: display.body_display,
    body_original: input.body,
    display_locale: display.display_locale,
    original_locale: input.original_locale,
    translations: translation.translations,
    translation_status:
      translation.translation_status === "none"
        ? display.translation_status
        : translation.translation_status,
    source_kind: input.source_kind,
    type: message_type,
    created_at,
    existing_payload: input.payload,
  })

  return insertMessage({
    message_uuid,
    room_uuid: input.room.room_uuid,
    participant_uuid: input.participant?.participant_uuid ?? null,
    type: message_type,
    body: input.body,
    payload,
  })
}

export async function deliverMessageBundle(input: {
  message: ChatMessageRecord
  room: ChatRoomRecord
  session: Session
  source_channel: SourceChannel
}) {
  const body_display = resolveMessageBodyDisplay(input.message, input.room.locale)
  const line_messages = input.message.payload?.line
    ? [input.message.payload.line]
    : undefined

  return deliverOutput(
    {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      channel: input.room.channel,
    },
    {
      text: body_display,
      data: input.message.payload?.web as Record<string, unknown> | undefined,
      line_messages,
    },
  )
}

export async function archiveBotFixedMessage(input: {
  key: BotMessageKey
  room: ChatRoomRecord
  participant: ChatParticipantRecord | null
  session: Session
  source_channel: SourceChannel
}) {
  const bot_message = await loadBotMessage({
    key: input.key,
    locale: input.room.locale,
  })

  return archivePreparedMessage({
    room: input.room,
    participant: input.participant,
    source_channel: input.source_channel,
    source_kind: "bot",
    type: bot_message.type,
    body: bot_message.body,
    original_locale: bot_message.locale,
    session: input.session,
    payload: bot_message.payload,
  })
}

export async function bootstrapRoomWelcome(input: {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  session: Session
  source_channel: SourceChannel
}) {
  const existing_messages = await loadRoomMessages(input.room.room_uuid)

  if (existing_messages.length > 0) {
    return null
  }

  const message = await archiveBotFixedMessage({
    key: "welcome",
    room: input.room,
    participant: input.participant,
    session: input.session,
    source_channel: input.source_channel,
  })

  await deliverMessageBundle({
    message,
    room: input.room,
    session: input.session,
    source_channel: input.source_channel,
  })

  return message
}
