import {
  handleIncomingChatMessageArchive,
  handleQuickMenuRequested,
} from "@/core/chat/action"
import { findMessageByExternalId } from "@/core/chat/archive"
import { sendAuthDebug } from "@/core/debug"
import {
  resolveLineWebhookContext,
  type LineWebhookRequest,
} from "@/core/line/context"
import {
  can_process_line_user,
  can_reply_to_line_user,
  get_allowed_line_users,
  get_line_webhook_test_mode,
  is_line_webhook_reply_enabled,
  resolve_line_reply_reason,
} from "@/core/line/rules"
import { beginLineReplyTokenScope } from "@/core/line/reply_token"

type LineEventSource = {
  userId?: string
}

type LineEvent = {
  source?: LineEventSource
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

export async function handleLineWebhook(request: LineWebhookRequest) {
  beginLineReplyTokenScope()

  const results: Array<{
    provider_user_id: string
    archived: boolean
    processed: boolean
    replied: boolean
    duplicate?: boolean
  }> = []

  for (const event of request.events) {
    if (!can_process_line_user(event.provider_user_id)) {
      console.info("[line_webhook] line_webhook_test_blocked", {
        provider_user_id: event.provider_user_id,
        reason: "line_test_mode_not_allowed",
      })

      results.push({
        provider_user_id: event.provider_user_id,
        archived: false,
        processed: false,
        replied: false,
      })
      continue
    }

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

        results.push({
          provider_user_id: event.provider_user_id,
          archived: true,
          processed: false,
          replied: false,
          duplicate: true,
        })
        continue
      }
    }

    const context = await resolveLineWebhookContext(event.provider_user_id)
    const reply_allowed = can_reply_to_line_user(event.provider_user_id)
    const can_reply = reply_allowed && Boolean(event.reply_token)

    await sendAuthDebug("line_reply_allowlist_checked", {
      provider_user_id: event.provider_user_id,
      allowed: reply_allowed,
      allowed_count: get_allowed_line_users().length,
      reply_enabled: is_line_webhook_reply_enabled(),
      test_mode: get_line_webhook_test_mode(),
    })

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
        },
        {
          deliver: false,
          bootstrap_welcome: false,
          apply_mode_command: false,
          provider_user_id: event.provider_user_id,
        },
      )

      await sendAuthDebug("line_webhook_reply_blocked", {
        provider_user_id: event.provider_user_id,
        reason: event.reply_token
          ? resolve_line_reply_reason(event.provider_user_id)
          : "missing_reply_token",
        source_channel: event.source_channel,
      })
      results.push({
        provider_user_id: event.provider_user_id,
        archived: true,
        processed: true,
        replied: false,
      })
      continue
    }

    await sendAuthDebug("line_webhook_reply_allowed", {
      provider_user_id: event.provider_user_id,
      reason: resolve_line_reply_reason(event.provider_user_id),
      source_channel: event.source_channel,
    })

    const archive_result = await handleIncomingChatMessageArchive(
      {
        body: event.body,
        source_channel: event.source_channel,
        locale: context.locale,
        session: context.session,
        external_id: event.external_id,
        line_reply_token: event.reply_token,
        line_provider_user_id: event.provider_user_id,
        line_reply_allowed: reply_allowed,
      },
      {
        deliver: false,
        deliver_mode_reply: true,
        bootstrap_welcome: false,
        apply_mode_command: true,
        provider_user_id: event.provider_user_id,
      },
    )

    if (archive_result.mode_command_handled) {
      results.push({
        provider_user_id: event.provider_user_id,
        archived: true,
        processed: true,
        replied: true,
      })
      continue
    }

    await handleQuickMenuRequested({
      source_channel: event.source_channel,
      locale: context.locale,
      session: context.session,
      line_reply_token: event.reply_token,
      line_provider_user_id: event.provider_user_id,
      line_reply_allowed: reply_allowed,
      bootstrap_welcome: false,
    })

    results.push({
      provider_user_id: event.provider_user_id,
      archived: true,
      processed: true,
      replied: true,
    })
  }

  return { ok: true, results }
}
