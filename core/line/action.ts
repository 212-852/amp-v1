import { normalizeContactContext } from "@/core/contacts/context"
import { upsertContact } from "@/core/contacts/action"
import { resolveUserUuidByIdentityValue } from "@/core/auth/identity"
import {
  handleIncomingChatMessageArchive,
  handleQuickMenuRequested,
} from "@/core/chat/action"
import { sendAuthDebug } from "@/core/debug"
import {
  resolveLineWebhookContext,
  type LineWebhookRequest,
} from "@/core/line/context"
import {
  can_reply_to_line_user,
  resolve_line_reply_reason,
} from "@/core/line/rules"

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

async function upsertWebhookLineContact(input: {
  user_uuid: string | null
  visitor_uuid: string | null
  provider_user_id: string
}) {
  return upsertContact(
    normalizeContactContext({
      user_uuid: input.user_uuid,
      visitor_uuid: input.visitor_uuid,
      type: "line",
      value: input.provider_user_id,
      channel: "line",
      receive: true,
    }),
  )
}

export async function handleLineWebhook(request: LineWebhookRequest) {
  const results: Array<{
    provider_user_id: string
    archived: boolean
    replied: boolean
  }> = []

  for (const event of request.events) {
    const context = await resolveLineWebhookContext(event.provider_user_id)
    const reply_allowed = can_reply_to_line_user(event.provider_user_id)

    await upsertWebhookLineContact({
      user_uuid: context.user_uuid,
      visitor_uuid: context.visitor_uuid,
      provider_user_id: event.provider_user_id,
    }).catch((error) => {
      return sendAuthDebug("line_webhook_contact_upsert_failed", {
        provider: "line",
        user_uuid: context.user_uuid,
        visitor_uuid: context.visitor_uuid,
        provider_user_id: event.provider_user_id,
        error_message: error instanceof Error ? error.message : String(error),
      })
    })

    const archive_result = await handleIncomingChatMessageArchive(
      {
        body: event.body,
        source_channel: event.source_channel,
        locale: context.locale,
        session: context.session,
        line_reply_token: reply_allowed ? event.reply_token : null,
      },
      {
        deliver: reply_allowed,
        bootstrap_welcome: false,
        apply_mode_command: reply_allowed,
      },
    )

    if (!reply_allowed || !event.reply_token) {
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
        replied: false,
      })
      continue
    }

    await sendAuthDebug("line_webhook_reply_allowed", {
      provider_user_id: event.provider_user_id,
      reason: resolve_line_reply_reason(event.provider_user_id),
      source_channel: event.source_channel,
    })

    if (!archive_result.mode_command_handled) {
      await handleQuickMenuRequested({
        source_channel: event.source_channel,
        locale: context.locale,
        session: context.session,
        line_reply_token: event.reply_token,
        bootstrap_welcome: false,
      })
    }

    results.push({
      provider_user_id: event.provider_user_id,
      archived: true,
      replied: true,
    })
  }

  return { ok: true, results }
}
