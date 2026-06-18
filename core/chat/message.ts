import { insertMessage } from "@/core/chat/archive"
import { ensureRoleParticipant } from "@/core/chat/participant"
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
import { sendAuthDebug } from "@/core/debug"
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

async function resolveArchiveParticipant(input: {
  room: ChatRoomRecord
  participant: ChatParticipantRecord | null
  source_kind: ChatMessageKind
}) {
  if (input.source_kind === "bot" || input.source_kind === "system") {
    return ensureRoleParticipant({
      room_uuid: input.room.room_uuid,
      role: "bot",
    })
  }

  if (input.source_kind === "concierge") {
    return ensureRoleParticipant({
      room_uuid: input.room.room_uuid,
      role: "concierge",
    })
  }

  if (!input.participant?.participant_uuid) {
    throw new Error("Chat message archive requires participant_uuid")
  }

  return input.participant
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
  const participant = await resolveArchiveParticipant({
    room: input.room,
    participant: input.participant,
    source_kind: input.source_kind,
  })
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

  let message: ChatMessageRecord

  try {
    message = await insertMessage({
      message_uuid,
      room_uuid: input.room.room_uuid,
      participant_uuid: participant.participant_uuid,
      type: message_type,
      body: input.body,
      payload,
    })
  } catch (error) {
    await sendAuthDebug("chat_archive_failed", {
      room_uuid: input.room.room_uuid,
      participant_uuid: participant.participant_uuid,
      source_kind: input.source_kind,
      type: message_type,
      error_message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  await sendAuthDebug("message_archived", {
    room_uuid: message.room_uuid,
    message_uuid: message.message_uuid,
    participant_uuid: message.participant_uuid,
    source_kind: input.source_kind,
    type: message.type,
  })

  return message
}

export async function archiveBotMessageBundle(input: {
  bundle: BotMessageBundle
  room: ChatRoomRecord
  participant: ChatParticipantRecord | null
}) {
  const participant = await ensureRoleParticipant({
    room_uuid: input.room.room_uuid,
    role: "bot",
  })
  let message: ChatMessageRecord

  try {
    message = await insertMessage({
      message_uuid: randomUUID(),
      room_uuid: input.room.room_uuid,
      participant_uuid: participant.participant_uuid,
      type: input.bundle.type,
      status: "sent",
      body: input.bundle.body,
      payload: input.bundle.payload,
    })
  } catch (error) {
    await sendAuthDebug("chat_archive_failed", {
      room_uuid: input.room.room_uuid,
      participant_uuid: participant.participant_uuid,
      source_kind: "bot",
      type: input.bundle.type,
      error_message: error instanceof Error ? error.message : String(error),
    })
    throw error
  }

  await sendAuthDebug("message_archived", {
    room_uuid: message.room_uuid,
    message_uuid: message.message_uuid,
    participant_uuid: message.participant_uuid,
    source_kind: "bot",
    type: message.type,
  })

  return message
}

export async function deliverMessageBundle(input: {
  message: ChatMessageRecord
  room: ChatRoomRecord
  session: Session
  source_channel: SourceChannel
  line_reply_token?: string | null
  line_provider_user_id?: string | null
  line_reply_allowed?: boolean
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
  const message_count = line_messages?.length ?? 1

  await sendAuthDebug("chat_output_bundle_built", {
    room_uuid: input.room.room_uuid,
    message_count,
    destination: input.room.channel,
  })

  return deliverOutput(
    {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      channel: input.room.channel,
      line_reply_token: input.line_reply_token,
      line_provider_user_id: input.line_provider_user_id,
      line_reply_allowed: input.line_reply_allowed,
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
  locale?: ChatLocale | null
}) {
  if (!(await shouldBootstrapWelcome(input.room.room_uuid))) {
    return null
  }

  const locale = input.locale ?? input.room.locale
  const bundle = createBotMessageBundle({
    trigger: "chat_opened",
    locale,
  })

  const message = await archiveBotMessageBundle({
    bundle,
    room: input.room,
    participant: input.participant,
  })

  await sendAuthDebug("welcome_message_created", {
    room_uuid: input.room.room_uuid,
    message_uuid: message.message_uuid,
    participant_uuid: message.participant_uuid,
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

export async function archiveBotTriggerMessage(input: {
  trigger: BotMessageTrigger
  room: ChatRoomRecord
  participant: ChatParticipantRecord | null
  session: Session
  source_channel: SourceChannel
  locale?: ChatLocale | null
  line_reply_token?: string | null
  line_provider_user_id?: string | null
  line_reply_allowed?: boolean
}) {
  const locale = input.locale ?? input.room.locale
  const bundle = createBotMessageBundle({
    trigger: input.trigger,
    locale,
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
    line_reply_token: input.line_reply_token,
    line_provider_user_id: input.line_provider_user_id,
    line_reply_allowed: input.line_reply_allowed,
  })

  return message
}
