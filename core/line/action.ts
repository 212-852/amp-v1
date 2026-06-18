import {
  handleIncomingChatMessageArchive,
  handleQuickMenuRequested,
} from "@/core/chat/action"
import { findMessageByExternalId } from "@/core/chat/archive"
import { sendAuthDebug } from "@/core/debug"
import {
  normalizeLineWebhookRequest,
  resolveLineWebhookContext,
  type LineIncomingEvent,
  type LineWebhookRequest,
} from "@/core/line/context"
import { resolve_line_webhook_gate } from "@/core/line/rules"
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

  const { resolveUserUuidByIdentityValue } = await import("@/core/auth/identity")
  const { upsertContact } = await import("@/core/contacts/action")
  const { normalizeContactContext } = await import("@/core/contacts/context")

  const user_uuid = await resolveUserUuidByIdentityValue(lineUserId)

  if (!user_uuid) {
    return null
  }

  return upsertContact(
    normalizeContactContext({
      user_uuid,
      type: "line",
      value: lineUserId,
    }),
  )
}

export async function upsertLineContactsFromEvents(events: LineEvent[]) {
  return Promise.all(events.map((event) => upsertLineContactFromEvent(event)))
}

async function emitLineWebhookGateDebug(
  event: LineIncomingEvent,
  gate: ReturnType<typeof resolve_line_webhook_gate>,
) {
  if (!gate.allowed) {
    await sendAuthDebug("line_webhook_ignored_not_allowed", {
      provider_user_id: event.provider_user_id,
      reason: gate.reason,
      source_channel: event.source_channel,
    })
    return
  }

  await sendAuthDebug("line_webhook_gate_resolved", {
    provider_user_id: event.provider_user_id,
    reason: gate.reason,
    archive: gate.archive,
    reply: gate.reply,
    output: gate.output,
    source_channel: event.source_channel,
  })
}

async function processAllowedLineEvent(
  event: LineIncomingEvent,
  gate: ReturnType<typeof resolve_line_webhook_gate>,
): Promise<LineWebhookEventResult> {
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
        gate_reason: gate.reason,
      }
    }
  }

  const context = await resolveLineWebhookContext(event.provider_user_id)

  if (!gate.archive) {
    return {
      provider_user_id: event.provider_user_id,
      ignored: false,
      archived: false,
      processed: false,
      replied: false,
      gate_reason: gate.reason,
    }
  }

  if (!gate.reply) {
    await handleIncomingChatMessageArchive(
      {
        body: event.body,
        source_channel: event.source_channel,
        locale: context.locale,
        session: context.session,
        external_id: event.external_id,
        line_provider_user_id: event.provider_user_id,
        line_reply_allowed: false,
      },
      {
        deliver: false,
        bootstrap_welcome: false,
        apply_mode_command: false,
      },
    )

    await sendAuthDebug("line_webhook_reply_blocked", {
      provider_user_id: event.provider_user_id,
      reason: gate.output ? "missing_reply_token" : "line_reply_disabled",
      source_channel: event.source_channel,
    })

    return {
      provider_user_id: event.provider_user_id,
      ignored: false,
      archived: true,
      processed: true,
      replied: false,
      gate_reason: gate.reason,
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
      line_reply_allowed: gate.output,
    },
    {
      deliver: false,
      deliver_mode_reply: gate.output,
      bootstrap_welcome: false,
      apply_mode_command: true,
    },
  )

  if (archive_result.mode_command_handled) {
    return {
      provider_user_id: event.provider_user_id,
      ignored: false,
      archived: true,
      processed: true,
      replied: gate.output,
      gate_reason: gate.reason,
    }
  }

  if (gate.output) {
    await handleQuickMenuRequested({
      source_channel: event.source_channel,
      locale: context.locale,
      session: context.session,
      line_reply_token: event.reply_token,
      line_provider_user_id: event.provider_user_id,
      line_reply_allowed: true,
      bootstrap_welcome: false,
    })
  }

  return {
    provider_user_id: event.provider_user_id,
    ignored: false,
    archived: true,
    processed: true,
    replied: gate.output,
    gate_reason: gate.reason,
  }
}

export async function handleLineWebhook(
  request: LineWebhookRequest,
): Promise<LineWebhookHandleResult> {
  beginLineReplyTokenScope()

  const results: LineWebhookEventResult[] = []
  let allowed_count = 0

  for (const event of request.events) {
    const gate = resolve_line_webhook_gate(event)

    await emitLineWebhookGateDebug(event, gate)

    if (!gate.allowed) {
      results.push({
        provider_user_id: event.provider_user_id,
        ignored: true,
        archived: false,
        processed: false,
        replied: false,
        gate_reason: gate.reason,
      })
      continue
    }

    allowed_count += 1

    try {
      results.push(await processAllowedLineEvent(event, gate))
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
    ignored_all: request.events.length > 0 && allowed_count === 0,
    results,
  }
}

export async function handleLineWebhookPayload(
  payload: unknown,
): Promise<LineWebhookHandleResult> {
  const request = await normalizeLineWebhookRequest(payload)
  return handleLineWebhook(request)
}
