import { archiveWelcomeMessage, insertMessage } from "@/core/chat/archive"
import { ensureRoleParticipant } from "@/core/chat/participant"
import type { PresenceMessageBundle } from "@/core/chat/presence"
import {
  resolveOutputLocaleDecision,
  type LocaleSource,
} from "@/core/chat/context"
import { createBotMessageBundle, type BotMessageBundle } from "@/core/bot/message"
import {
  isLineFlexCarouselPayload,
  resolveBotAltText,
  type BotMessageTrigger,
  type LineFlexCarouselPayload,
} from "@/core/bot/rules"
import {
  build_card_hero,
  build_card_primary_button,
} from "@/core/output/rules"
import {
  PARTNER_DRIVER_RECRUIT_ALT_TEXT,
  PARTNER_DRIVER_RECRUIT_BODY,
  PARTNER_DRIVER_RECRUIT_BUTTON_LABEL,
  PARTNER_DRIVER_RECRUIT_DESCRIPTION,
  PARTNER_DRIVER_RECRUIT_IMAGE,
  PARTNER_DRIVER_LINE_REGISTER_PATH,
  PARTNER_DRIVER_RECRUIT_TITLE,
} from "@/core/partner/recruitment"
import {
  type ChatResponseRoute,
  buildMessagePayload,
  readMessageMeta,
  readMessageSourceKind,
  resolveArchivedMessageType,
  resolveDisplayFields,
  resolveMessageBodyDisplay,
  resolveMessageDisplayLocale,
  resolveMessageOriginalLocale,
  resolveMessageTranslations,
  shouldSkipUserOutputDelivery,
} from "@/core/chat/rules"
import { ensureRoomLocaleTranslation } from "@/core/chat/translate"
import { getChatContentKeyCount } from "@/core/chat/content"
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
  external_id?: string | null
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

function resolveLocaleDebugSource(input: {
  app_locale?: string | null
  session_locale?: string | null
  user_locale?: string | null
  room_locale?: ChatLocale | null
}): LocaleSource {
  if (input.app_locale) {
    return "explicit"
  }

  if (input.session_locale) {
    return "session_locale"
  }

  if (input.user_locale) {
    return "user_locale"
  }

  if (input.room_locale) {
    return "room_locale"
  }

  return "fallback"
}

function resolveFlexAltText(body: string, locale: ChatLocale) {
  if (body === "quick_menu") {
    return resolveBotAltText("quick_menu_requested", locale)
  }

  if (body === "welcome") {
    return resolveBotAltText("chat_opened", locale)
  }

  if (body === PARTNER_DRIVER_RECRUIT_BODY) {
    return PARTNER_DRIVER_RECRUIT_ALT_TEXT
  }

  return body
}

function build_partner_recruit_uri_footer() {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    paddingAll: "12px",
    contents: [
      build_card_primary_button({
        label: PARTNER_DRIVER_RECRUIT_BUTTON_LABEL,
        action: {
          type: "uri",
          uri: PARTNER_DRIVER_LINE_REGISTER_PATH,
        },
      }),
    ],
  }
}

function build_partner_recruit_bubble(input: { include_registration_button: boolean }) {
  const bubble: Record<string, unknown> = {
    type: "bubble",
    hero: build_card_hero({ url: PARTNER_DRIVER_RECRUIT_IMAGE }),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: PARTNER_DRIVER_RECRUIT_TITLE,
          weight: "bold",
          size: "md",
          color: "#3D2A19",
        },
        {
          type: "text",
          text: PARTNER_DRIVER_RECRUIT_DESCRIPTION,
          wrap: true,
          size: "sm",
          color: "#8C7358",
        },
      ],
    },
  }

  if (input.include_registration_button) {
    bubble.footer = build_partner_recruit_uri_footer()
  }

  return bubble
}

export function build_partner_driver_recruitment_carousel(input?: {
  include_registration_button?: boolean
}): LineFlexCarouselPayload {
  return {
    type: "carousel",
    contents: [
      build_partner_recruit_bubble({
        include_registration_button: input?.include_registration_button !== false,
      }) as LineFlexCarouselPayload["contents"][number],
    ],
  }
}

export function build_partner_driver_recruitment_bundle(input?: {
  include_registration_button?: boolean
}) {
  return {
    type: "flex" as const,
    body: PARTNER_DRIVER_RECRUIT_BODY,
    alt_text: PARTNER_DRIVER_RECRUIT_ALT_TEXT,
    payload: build_partner_driver_recruitment_carousel(input),
  }
}

export function build_line_link_guidance_bundle() {
  return {
    type: "text" as const,
    body: "LINE連携にはログインが必要です。LINEでログイン後、もう一度この画面を開いてください。",
  }
}

export function build_chat_response_message_bundle(route: ChatResponseRoute) {
  if (
    route.selected_action === "line_link_guidance" ||
    route.selected_action === "line_link_required"
  ) {
    return build_line_link_guidance_bundle()
  }

  if (
    route.selected_action === "show_driver_registration" &&
    route.can_show_registration_card
  ) {
    return build_partner_driver_recruitment_bundle({
      include_registration_button: true,
    })
  }

  return null
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
  const message_type = resolveArchivedMessageType({
    source_kind: input.source_kind,
    type: input.type,
  })

  try {
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

    const message = await insertMessage({
      message_uuid,
      room_uuid: input.room.room_uuid,
      participant_uuid: participant.participant_uuid,
      type: message_type,
      body: input.body,
      payload,
      source_channel: input.source_channel,
      external_id: input.external_id ?? null,
    })

    await sendAuthDebug("message_archived", {
      room_uuid: message.room_uuid,
      message_uuid: message.message_uuid,
      participant_uuid: message.participant_uuid,
      source_kind: input.source_kind,
      type: message.type,
    })

    const { broadcastMessageInserted } = await import("@/core/chat/realtime")
    await broadcastMessageInserted(message).catch(() => null)

    return message
  } catch (error) {
    await sendAuthDebug("chat_archive_failed", {
      room_uuid: input.room.room_uuid,
      participant_uuid: input.participant?.participant_uuid ?? null,
      source_kind: input.source_kind,
      type: message_type,
      source_channel: input.source_channel,
      error_message: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
}

export async function archivePresenceMessageBundle(input: {
  bundle: PresenceMessageBundle
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  source_channel: SourceChannel
  session: Session
}) {
  return archivePreparedMessage({
    room: input.room,
    participant: input.participant,
    source_channel: input.source_channel,
    source_kind: "system",
    type: "system",
    body: input.bundle.body,
    original_locale: input.bundle.original_locale,
    session: input.session,
    payload: input.bundle.payload,
  })
}

export async function archiveBotMessageBundle(input: {
  bundle: BotMessageBundle
  room: ChatRoomRecord
  participant: ChatParticipantRecord | null
  source_channel: SourceChannel
}) {
  if (input.bundle.body === "welcome") {
    const message = await archiveWelcomeMessage({
      room_uuid: input.room.room_uuid,
      type: input.bundle.type,
      body: input.bundle.body,
      payload: input.bundle.payload as Record<string, unknown> | null,
      source_channel: input.source_channel,
    })

    await sendAuthDebug("message_archived", {
      room_uuid: message.room_uuid,
      message_uuid: message.message_uuid,
      participant_uuid: message.participant_uuid,
      source_kind: "bot",
      type: message.type,
      message_kind: "welcome",
    })

    return message
  }

  const message_kind = null
  let participant: ChatParticipantRecord | null = input.participant

  try {
    participant = await ensureRoleParticipant({
      room_uuid: input.room.room_uuid,
      role: "bot",
    })
    const message = await insertMessage({
      message_uuid: randomUUID(),
      room_uuid: input.room.room_uuid,
      participant_uuid: participant.participant_uuid,
      type: input.bundle.type,
      status: "sent",
      body: input.bundle.body,
      payload: input.bundle.payload,
      source_channel: input.source_channel,
    })

    await sendAuthDebug("message_archived", {
      room_uuid: message.room_uuid,
      message_uuid: message.message_uuid,
      participant_uuid: message.participant_uuid,
      source_kind: "bot",
      type: message.type,
    })

    return message
  } catch (error) {
    await sendAuthDebug("chat_archive_failed", {
      room_uuid: input.room.room_uuid,
      participant_uuid: participant?.participant_uuid ?? null,
      source_kind: "bot",
      type: input.bundle.type,
      message_kind,
      source_channel: input.source_channel,
      error_message: error instanceof Error ? error.message : String(error),
    })

    throw error
  }
}

export async function deliverMessageBundle(input: {
  message: ChatMessageRecord
  room: ChatRoomRecord
  session: Session
  source_channel: SourceChannel
  source_message_uuid?: string | null
  selected_action?: string | null
  source_event_uuid?: string | null
  normalized_text?: string | null
  line_reply_token?: string | null
  line_provider_user_id?: string | null
  line_reply_allowed?: boolean
}) {
  if (shouldSkipUserOutputDelivery(input.message)) {
    await sendAuthDebug("chat_output_delivery_skipped", {
      room_uuid: input.room.room_uuid,
      message_uuid: input.message.message_uuid,
      reason: "admin_presence_system",
    })
    return []
  }

  const payload = input.message.payload
  const alt_text = resolveFlexAltText(input.message.body, input.room.locale)
  const payload_record = payload as Record<string, unknown> | null
  const message_meta = readMessageMeta(payload)
  const selected_action =
    input.selected_action ??
    (typeof message_meta.selected_action === "string"
      ? message_meta.selected_action
      : null)
  const source_message_uuid =
    input.source_message_uuid ??
    (typeof message_meta.trigger_message_uuid === "string"
      ? message_meta.trigger_message_uuid
      : input.message.message_uuid)
  const output_data = isLineFlexCarouselPayload(payload_record)
    ? {
        ...payload_record,
        source_message_uuid,
        selected_action,
        meta: {
          ...message_meta,
          room_uuid: input.room.room_uuid,
          message_bundle_type: input.message.body,
          trigger_message_uuid: source_message_uuid,
          source_event_uuid: input.source_event_uuid ?? undefined,
          normalized_text: input.normalized_text ?? undefined,
          selected_action,
        },
      }
    : payload_record ?? undefined

  const allow_line_reply =
    input.source_channel === "line" && input.line_reply_allowed === true

  await sendAuthDebug("chat_output_bundle_built", {
    room_uuid: input.room.room_uuid,
    message_count: 1,
    destination: input.source_channel,
    source_channel: input.source_channel,
    has_reply_token: Boolean(input.line_reply_token),
    line_reply_allowed: allow_line_reply,
  })

  return deliverOutput(
    {
      user_uuid: input.session.user_uuid,
      visitor_uuid: input.session.visitor_uuid,
      room_uuid: input.room.room_uuid,
      channel: input.source_channel,
      line_reply_token: allow_line_reply ? input.line_reply_token ?? null : null,
      line_provider_user_id: input.line_provider_user_id,
      line_reply_allowed: allow_line_reply,
    },
    {
      text: alt_text,
      data: output_data,
      source_message_uuid,
      selected_action,
      source_event_uuid: input.source_event_uuid,
      normalized_text: input.normalized_text,
    },
  )
}

export function buildWelcomeMessageBundle(locale: ChatLocale) {
  return createBotMessageBundle({
    trigger: "chat_opened",
    locale,
  })
}

export async function ensureWelcomeMessageArchived(input: {
  room: ChatRoomRecord
  source_channel: SourceChannel
  locale?: ChatLocale | null
  deliver?: boolean
  session?: Session
}) {
  const locale_decision = resolveOutputLocaleDecision({
    preferred: input.locale,
    room_locale: input.room.locale,
  })
  const locale = locale_decision.final_locale

  await sendAuthDebug("chat_message_locale_used", {
    final_locale: locale,
    source: locale_decision.source,
    message_kind: "welcome",
    content_key_count: getChatContentKeyCount(),
  })

  const bundle = buildWelcomeMessageBundle(locale)

  await sendAuthDebug("chat_welcome_bundle_built", {
    room_uuid: input.room.room_uuid,
    final_locale: locale,
    source: locale_decision.source,
  })

  const message = await archiveWelcomeMessage({
    room_uuid: input.room.room_uuid,
    type: bundle.type,
    body: bundle.body,
    payload: bundle.payload as Record<string, unknown> | null,
    source_channel: input.source_channel,
  })

  await sendAuthDebug("welcome_message_created", {
    room_uuid: input.room.room_uuid,
    message_uuid: message.message_uuid,
    participant_uuid: message.participant_uuid,
    source_channel: input.source_channel,
  })

  if (input.deliver && input.session) {
    await deliverMessageBundle({
      message,
      room: input.room,
      session: input.session,
      source_channel: input.source_channel,
    })
  }

  return message
}

/** @deprecated Use ensureWelcomeMessageArchived */
export async function bootstrapRoomWelcome(input: {
  room: ChatRoomRecord
  participant: ChatParticipantRecord
  session: Session
  source_channel: SourceChannel
  locale?: ChatLocale | null
  defer_archive?: boolean
}) {
  void input.participant
  void input.defer_archive
  return ensureWelcomeMessageArchived({
    room: input.room,
    source_channel: input.source_channel,
    locale: input.locale,
    deliver: true,
    session: input.session,
  })
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
  const locale_decision = resolveOutputLocaleDecision({
    preferred: input.locale,
    room_locale: input.room.locale,
  })
  const locale = locale_decision.final_locale

  await sendAuthDebug("chat_message_locale_used", {
    final_locale: locale,
    source: locale_decision.source,
    message_kind:
      input.trigger === "quick_menu_requested" ? "quick_menu" : "bot_response",
    content_key_count: getChatContentKeyCount(),
  })

  if (input.trigger === "quick_menu_requested") {
    await sendAuthDebug("chat_quick_menu_locale_resolved", {
      app_locale: input.locale ?? null,
      session_locale: null,
      user_locale: null,
      room_locale: input.room.locale,
      bundle_locale: locale,
      final_locale: locale,
      source: locale_decision.source ?? resolveLocaleDebugSource({
        app_locale: input.locale ?? null,
        room_locale: input.room.locale,
      }),
    })
  }
  const bundle = createBotMessageBundle({
    trigger: input.trigger,
    locale,
  })

  const message = await archiveBotMessageBundle({
    bundle,
    room: input.room,
    participant: input.participant,
    source_channel: input.source_channel,
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
