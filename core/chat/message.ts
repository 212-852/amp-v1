import { insertMessage } from "@/core/chat/archive"
import {
  carouselPayloadToLineFlex,
  isLineFlexCarouselPayload,
  resolveBotAltText,
  type BotMessageTrigger,
} from "@/core/bot/rules"
import { createBotMessageBundle, type BotMessageBundle } from "@/core/bot/message"
import {
  buildMessagePayload,
  readMessageSourceKind,
  resolveArchivedMessageType,
  resolveDisplayFields,
  resolveMessageBodyDisplay,
  resolveMessageDisplayLocale,
  resolveMessageOriginalLocale,
  resolveMessageTranslations,
  shouldBootstrapWelcome,
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
  source_kind: ChatMessageKind
  type?: ChatMessageType
  body: string
  original_locale: ChatLocale
  session: Session
  translations?: ChatTranslations
  payload?: Record<string, unknown> | null
}

function resolveFlexAltText(body: string, locale: ChatLocale) {
  if (body === "quick_menu") {
    return resolveBotAltText("quick_menu_requested", locale)
  }

  if (body === "welcome") {
    return resolveBotAltText("chat_opened", locale)
  }

  return body
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

export async function archiveBotMessageBundle(input: {
  bundle: BotMessageBundle
  room: ChatRoomRecord
  participant: ChatParticipantRecord | null
}) {
  return insertMessage({
    message_uuid: randomUUID(),
    room_uuid: input.room.room_uuid,
    participant_uuid: input.participant?.participant_uuid ?? null,
    type: input.bundle.type,
    status: "sent",
    body: input.bundle.body,
    payload: input.bundle.payload,
  })
}

export async function deliverMessageBundle(input: {
  message: ChatMessageRecord
  room: ChatRoomRecord
  session: Session
  source_channel: SourceChannel
}) {
  const payload = input.message.payload
  const alt_text = resolveFlexAltText(input.message.body, input.room.locale)

  const line_messages = isLineFlexCarouselPayload(payload)
    ? [
        carouselPayloadToLineFlex({
          payload,
          alt_text,
        }),
      ]
    : undefined

  return deliverOutput(
    {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      channel: input.room.channel,
    },
    {
      text: alt_text,
      data: payload as Record<string, unknown> | undefined,
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
  if (!(await shouldBootstrapWelcome(input.room.room_uuid))) {
    return null
  }

  const bundle = createBotMessageBundle({
    trigger: "chat_opened",
    locale: input.room.locale,
  })

  const message = await archiveBotMessageBundle({
    bundle,
    room: input.room,
    participant: input.participant,
  })

  await deliverMessageBundle({
    message,
    room: input.room,
    session: input.session,
    source_channel: input.source_channel,
  })

  return message
}

export async function archiveBotTriggerMessage(input: {
  trigger: BotMessageTrigger
  room: ChatRoomRecord
  participant: ChatParticipantRecord | null
  session: Session
  source_channel: SourceChannel
}) {
  const bundle = createBotMessageBundle({
    trigger: input.trigger,
    locale: input.room.locale,
  })

  const message = await archiveBotMessageBundle({
    bundle,
    room: input.room,
    participant: input.participant,
  })

  await deliverMessageBundle({
    message,
    room: input.room,
    session: input.session,
    source_channel: input.source_channel,
  })

  return message
}
