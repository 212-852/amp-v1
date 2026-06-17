import { insertMessage, loadRoomMessages } from "@/core/chat/archive"
import {
  buildLineFlexPayload,
  buildWebMessagePayload,
  resolveArchivedMessageType,
  resolveDisplayFields,
  resolveWelcomeMessage,
} from "@/core/chat/rules"
import { ensureRoomLocaleTranslation } from "@/core/chat/translate"
import type {
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
  kind: ChatMessageKind
  type?: ChatMessageType
  body: string
  original_locale: ChatLocale
  session: Session
  translations?: ChatTranslations
}

export function toMessageBundle(message: ChatMessageRecord): MessageBundle {
  return {
    message_uuid: message.message_uuid,
    room_uuid: message.room_uuid,
    kind: message.kind,
    type: message.type,
    source_channel: message.source_channel,
    body_display: message.body_display,
    body_original: message.body_original,
    display_locale: message.display_locale,
    original_locale: message.original_locale,
    translations: message.translations,
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
    kind: input.kind,
    type: input.type,
  })
  const message_uuid = randomUUID()
  const created_at = new Date().toISOString()
  const payload = {
    web: buildWebMessagePayload({
      message_uuid,
      body_display: display.body_display,
      body_original: input.body,
      display_locale: display.display_locale,
      original_locale: input.original_locale,
      translations: translation.translations,
      kind: input.kind,
      type: message_type,
      created_at,
    }),
    line: buildLineFlexPayload({
      body_display: display.body_display,
      kind: input.kind,
    }),
  }

  return insertMessage({
    message_uuid,
    room_uuid: input.room.room_uuid,
    participant_uuid: input.participant?.participant_uuid ?? null,
    source_channel: input.source_channel,
    kind: input.kind,
    type: message_type,
    body_original: input.body,
    original_locale: input.original_locale,
    body_display: display.body_display,
    display_locale: display.display_locale,
    translations: translation.translations,
    translation_status:
      translation.translation_status === "none"
        ? display.translation_status
        : translation.translation_status,
    payload,
  })
}

export async function deliverMessageBundle(input: {
  message: ChatMessageRecord
  session: Session
  source_channel: SourceChannel
}) {
  const line_messages = input.message.payload?.line
    ? [input.message.payload.line]
    : undefined

  if (
    input.source_channel === "web" ||
    input.source_channel === "pwa" ||
    input.source_channel === "liff"
  ) {
    return []
  }

  return deliverOutput(
    {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
    },
    {
      text: input.message.body_display,
      data: input.message.payload?.web as Record<string, unknown> | undefined,
      line_messages,
    },
  )
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

  const message = await archivePreparedMessage({
    room: input.room,
    participant: input.participant,
    source_channel: input.source_channel,
    kind: "system",
    type: "system",
    body: resolveWelcomeMessage(input.room.locale),
    original_locale: input.room.locale,
    session: input.session,
  })

  await deliverMessageBundle({
    message,
    session: input.session,
    source_channel: input.source_channel,
  })

  return message
}
