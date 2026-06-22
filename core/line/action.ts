import {
  handleIncomingChatMessageArchive,
  handleQuickMenuRequested,
} from "@/core/chat/action"
import { findMessageByExternalId } from "@/core/chat/archive"
import { sendAuthDebug } from "@/core/debug"
import {
  resolveLineWebhookContext,
  type LineIncomingEvent,
  type LineWebhookRequest,
} from "@/core/line/context"
import {
  can_reply_to_allowed_line_event,
  is_line_webhook_reply_enabled,
} from "@/core/line/rules"
import { beginLineReplyTokenScope } from "@/core/line/reply_token"

type LineEventSource = {
  userId?: string
}

type LineEvent = {
  source?: LineEventSource
}

export type LineWebhookEventResult = {
  provider_user_id: string
  ignored: boolean
  archived: boolean
  processed: boolean
  replied: boolean
  duplicate?: boolean
  gate_reason: string
}

export type LineWebhookHandleResult = {
  ok: boolean
  ignored_all: boolean
  results: LineWebhookEventResult[]
  error?: string
}

export async function upsertLineContactFromEvent(event: LineEvent) {
  const lineUserId = event.source?.userId

  if (!lineUserId) {
    return null
  }

  return null
}

export async function upsertLineContactsFromEvents(events: LineEvent[]) {
  return Promise.all(events.map((event) => upsertLineContactFromEvent(event)))
}

async function processAllowedLineEvent(
  event: LineIncomingEvent,
): Promise<LineWebhookEventResult> {
  const can_reply = can_reply_to_allowed_line_event(event)

  await sendAuthDebug("line_event_normalized", {
    provider_user_id: event.provider_user_id,
    message_type: event.message_type,
    text: event.body,
    external_id: event.external_id,
    reply_token_exists: Boolean(event.reply_token),
  })

  if (event.external_id) {
    const duplicate = await findMessageByExternalId({
      source_channel: event.source_channel,
      external_id: event.external_id,
    })

    if (duplicate) {
      await sendAuthDebug("line_message_duplicate_skipped", {
        provider_user_id: event.provider_user_id,
        external_id: event.external_id,
        message_uuid: duplicate.message_uuid,
        room_uuid: duplicate.room_uuid,
      })

      return {
        provider_user_id: event.provider_user_id,
        ignored: false,
        archived: true,
        processed: false,
        replied: false,
        duplicate: true,
        gate_reason: "allowed",
      }
    }
  }

  const context = await resolveLineWebhookContext(event.provider_user_id)

  if (!can_reply) {
    await handleIncomingChatMessageArchive(
      {
        body: event.body,
        source_channel: event.source_channel,
        locale: context.locale,
        session: context.session,
        external_id: event.external_id,
        line_provider_user_id: event.provider_user_id,
        line_reply_allowed: false,
        line_identity_linked: Boolean(context.identity_uuid && context.user_uuid),
      },
      {
        deliver: false,
        bootstrap_welcome: false,
        apply_mode_command: false,
      },
    )

    await sendAuthDebug("line_webhook_reply_blocked", {
      provider_user_id: event.provider_user_id,
      reason: event.reply_token ? "line_reply_disabled" : "missing_reply_token",
      source_channel: event.source_channel,
    })

    return {
      provider_user_id: event.provider_user_id,
      ignored: false,
      archived: true,
      processed: true,
      replied: false,
      gate_reason: is_line_webhook_reply_enabled()
        ? "missing_reply_token"
        : "line_reply_disabled",
    }
  }

  const archive_result = await handleIncomingChatMessageArchive(
    {
      body: event.body,
      source_channel: event.source_channel,
      locale: context.locale,
      session: context.session,
      external_id: event.external_id,
      line_reply_token: event.reply_token,
      line_provider_user_id: event.provider_user_id,
      line_reply_allowed: true,
      line_identity_linked: Boolean(context.identity_uuid && context.user_uuid),
    },
    {
      deliver: false,
      deliver_mode_reply: true,
      bootstrap_welcome: false,
      apply_mode_command: true,
    },
  )

  if (
    archive_result.mode_command_handled ||
    archive_result.driver_partner_handled
  ) {
    return {
      provider_user_id: event.provider_user_id,
      ignored: false,
      archived: true,
      processed: true,
      replied: true,
      gate_reason: "allowed",
    }
  }

  await handleQuickMenuRequested({
    source_channel: event.source_channel,
    locale: context.locale,
    session: context.session,
    line_reply_token: event.reply_token,
    line_provider_user_id: event.provider_user_id,
    line_reply_allowed: true,
    bootstrap_welcome: false,
  })

  return {
    provider_user_id: event.provider_user_id,
    ignored: false,
    archived: true,
    processed: true,
    replied: true,
    gate_reason: "allowed",
  }
}

export async function handleLineWebhook(
  request: LineWebhookRequest,
): Promise<LineWebhookHandleResult> {
  beginLineReplyTokenScope()

  const results: LineWebhookEventResult[] = []

  for (const event of request.events) {
    try {
      results.push(await processAllowedLineEvent(event))
    } catch (error) {
      await sendAuthDebug("line_webhook_event_failed", {
        provider_user_id: event.provider_user_id,
        error_message: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  return {
    ok: true,
    ignored_all: false,
    results,
  }
}
