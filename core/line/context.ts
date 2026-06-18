import type { AppSession } from "@/core/auth/session"
import type { SourceChannel } from "@/core/auth/types"
import { resolveStableLineIdentity } from "@/core/line/identity"
import { sendAuthDebug } from "@/core/debug"

type LineWebhookSource = {
  type?: unknown
  userId?: unknown
}

type LineWebhookMessage = {
  type?: unknown
  text?: unknown
  id?: unknown
}

type LineWebhookEvent = {
  type?: unknown
  replyToken?: unknown
  source?: LineWebhookSource
  message?: LineWebhookMessage
}

export type LineIncomingEvent = {
  event_type: "message"
  message_type: "text"
  body: string
  provider_user_id: string
  reply_token: string | null
  external_id: string | null
  source_channel: SourceChannel
}

export type LineWebhookRequest = {
  events: LineIncomingEvent[]
}

export type LineWebhookContext = {
  user_uuid: string | null
  visitor_uuid: string | null
  identity_uuid: string | null
  session: AppSession
  locale: string | null
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeLineEvent(event: LineWebhookEvent): LineIncomingEvent | null {
  if (event.type !== "message" || event.message?.type !== "text") {
    return null
  }

  const provider_user_id = normalizeString(event.source?.userId)
  const body = normalizeString(event.message.text)
  const external_id = normalizeString(event.message.id)

  if (!provider_user_id || !body) {
    return null
  }

  return {
    event_type: "message",
    message_type: "text",
    body,
    provider_user_id,
    reply_token: normalizeString(event.replyToken),
    external_id,
    source_channel: "line",
  }
}

export async function normalizeLineWebhookRequest(
  input: unknown,
): Promise<LineWebhookRequest> {
  const payload =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as { events?: unknown })
      : {}
  const raw_events = Array.isArray(payload.events) ? payload.events : []

  const events = raw_events
    .map((event) => normalizeLineEvent(event as LineWebhookEvent))
    .filter((event): event is LineIncomingEvent => Boolean(event))

  return { events }
}

export async function resolveLineWebhookContext(
  provider_user_id: string,
): Promise<LineWebhookContext> {
  const stable = await resolveStableLineIdentity(provider_user_id)

  await sendAuthDebug("line_identity_resolved", {
    provider_user_id,
    user_uuid: stable.user_uuid,
    visitor_uuid: stable.visitor_uuid,
    identity_uuid: stable.identity_uuid,
    found: Boolean(stable.user_uuid || stable.visitor_uuid),
  })

  return {
    user_uuid: stable.user_uuid,
    visitor_uuid: stable.visitor_uuid,
    identity_uuid: stable.identity_uuid,
    session: stable.session,
    locale: stable.locale,
  }
}
