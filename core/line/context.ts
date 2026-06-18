import type { SourceChannel } from "@/core/auth/types"

type LineWebhookSource = {
  type?: unknown
  userId?: unknown
}

type LineWebhookMessage = {
  type?: unknown
  text?: unknown
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
  source_channel: SourceChannel
}

export type LineWebhookRequest = {
  events: LineIncomingEvent[]
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

  if (!provider_user_id || !body) {
    return null
  }

  return {
    event_type: "message",
    message_type: "text",
    body,
    provider_user_id,
    reply_token: normalizeString(event.replyToken),
    source_channel: "line",
  }
}

export function normalizeLineWebhookRequest(input: unknown): LineWebhookRequest {
  const payload =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as { events?: unknown })
      : {}
  const raw_events = Array.isArray(payload.events) ? payload.events : []

  return {
    events: raw_events
      .map((event) => normalizeLineEvent(event as LineWebhookEvent))
      .filter((event): event is LineIncomingEvent => Boolean(event)),
  }
}
