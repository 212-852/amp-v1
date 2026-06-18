import { normalizeContactContext } from "@/core/contacts/context"
import { upsertContact } from "@/core/contacts/action"
import { resolveUserUuidByIdentityValue } from "@/core/auth/identity"
import {
  handleIncomingChatMessageArchive,
  handleQuickMenuRequested,
} from "@/core/chat/action"
import { sendAuthDebug } from "@/core/debug"
import type { LineWebhookRequest } from "@/core/line/context"
import { resolveLineWebhookAccess } from "@/core/line/rules"

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
    const access = await resolveLineWebhookAccess(event.provider_user_id)

    if (!access.session) {
      await sendAuthDebug("line_webhook_identity_unresolved", {
        provider: "line",
        provider_user_id: event.provider_user_id,
        source_channel: event.source_channel,
      })
      results.push({
        provider_user_id: event.provider_user_id,
        archived: false,
        replied: false,
      })
      continue
    }

    await upsertWebhookLineContact({
      user_uuid: access.user_uuid,
      visitor_uuid: access.visitor_uuid,
      provider_user_id: event.provider_user_id,
    }).catch((error) => {
      return sendAuthDebug("line_webhook_contact_upsert_failed", {
        provider: "line",
        user_uuid: access.user_uuid,
        visitor_uuid: access.visitor_uuid,
        provider_user_id: event.provider_user_id,
        error_message: error instanceof Error ? error.message : String(error),
      })
    })

    await handleIncomingChatMessageArchive(
      {
        body: event.body,
        source_channel: event.source_channel,
        locale: access.locale,
        session: access.session,
      },
      {
        deliver: false,
        bootstrap_welcome: false,
      },
    )

    if (!access.reply_allowed || !event.reply_token) {
      await sendAuthDebug("line_webhook_reply_blocked", {
        provider: "line",
        user_uuid: access.user_uuid,
        visitor_uuid: access.visitor_uuid,
        provider_user_id: event.provider_user_id,
        reason: event.reply_token ? access.reply_reason : "missing_reply_token",
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
      provider: "line",
      user_uuid: access.user_uuid,
      visitor_uuid: access.visitor_uuid,
      provider_user_id: event.provider_user_id,
      reason: access.reply_reason,
      source_channel: event.source_channel,
    })

    await handleQuickMenuRequested({
      source_channel: event.source_channel,
      locale: access.locale,
      session: access.session,
      line_reply_token: event.reply_token,
      bootstrap_welcome: false,
    })

    results.push({
      provider_user_id: event.provider_user_id,
      archived: true,
      replied: true,
    })
  }

  return { ok: true, results }
}
