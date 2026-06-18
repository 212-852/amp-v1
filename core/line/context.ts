import type { AppSession } from "@/core/auth/session"
import type { SourceChannel } from "@/core/auth/types"
import { resolveIdentityByProviderUserId } from "@/core/auth/identity"
import { findVisitorUuidByUser, findOldestParticipantByUserUuid } from "@/core/chat/archive"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendAuthDebug } from "@/core/debug"
import { randomUUID } from "crypto"

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

type UserRow = {
  role?: string
  tier?: string
  display_name?: string | null
  image_url?: string | null
  locale?: string | null
}

type LineContactIdentityRow = {
  visitor_uuid?: string | null
  user_uuid?: string | null
}

type VisitorRow = {
  visitor_uuid?: string | null
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

  await Promise.all(
    events.map((event) =>
      sendAuthDebug("line_event_normalized", {
        provider_user_id: event.provider_user_id,
        message_type: event.message_type,
        text: event.body,
        reply_token_exists: Boolean(event.reply_token),
      }),
    ),
  )

  return { events }
}

async function findLineContactIdentity(provider_user_id: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      [
        "type=eq.line",
        `value=eq.${encodeURIComponent(provider_user_id)}`,
        "select=visitor_uuid,user_uuid",
        "order=last_seen_at.desc.nullslast",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as LineContactIdentityRow[]
  return rows[0] ?? null
}

async function createLineVisitor() {
  const config = getRestConfig()

  if (!config) {
    return randomUUID()
  }

  const visitor_uuid = randomUUID()
  const response = await fetch(
    restUrl(config, "visitors", "select=visitor_uuid"),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        visitor_uuid,
        source_channel: "line",
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to create LINE visitor: ${error.message ?? "unknown"}`,
    )
  }

  const rows = (await response.json()) as VisitorRow[]
  return rows[0]?.visitor_uuid ?? visitor_uuid
}

async function resolveLineVisitorUuid(
  provider_user_id: string,
  contact: LineContactIdentityRow | null,
  user_uuid: string | null,
) {
  if (contact?.visitor_uuid) {
    return contact.visitor_uuid
  }

  if (user_uuid) {
    const visitor_from_user = await findVisitorUuidByUser(user_uuid)

    if (visitor_from_user) {
      return visitor_from_user
    }

    const participant = await findOldestParticipantByUserUuid(user_uuid)

    if (participant?.visitor_uuid) {
      return participant.visitor_uuid
    }
  }

  void provider_user_id
  return createLineVisitor()
}

async function loadLineUser(user_uuid: string): Promise<UserRow | null> {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "users",
      `user_uuid=eq.${encodeURIComponent(user_uuid)}&select=role,tier,display_name,image_url,locale&limit=1`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as UserRow[]
  return rows[0] ?? null
}

function resolveLineRole(role: string | undefined): AppSession["role"] {
  if (role === "admin" || role === "driver" || role === "user") {
    return role
  }

  return "user"
}

export async function resolveLineWebhookContext(
  provider_user_id: string,
): Promise<LineWebhookContext> {
  const [identity, line_contact] = await Promise.all([
    resolveIdentityByProviderUserId({
      provider: "line",
      provider_user_id,
    }),
    findLineContactIdentity(provider_user_id),
  ])
  const user_uuid = identity?.user_uuid ?? line_contact?.user_uuid ?? null

  await sendAuthDebug("line_identity_resolved", {
    provider_user_id,
    user_uuid,
    identity_uuid: identity?.identity_uuid ?? null,
    found: Boolean(user_uuid),
  })

  if (!user_uuid) {
    const visitor_uuid = await resolveLineVisitorUuid(
      provider_user_id,
      line_contact,
      null,
    )

    return {
      user_uuid: null,
      visitor_uuid,
      identity_uuid: identity?.identity_uuid ?? null,
      session: {
        visitor_uuid,
        user_uuid: null,
        role: "guest",
        tier: "guest",
        display_name: null,
        image_url: null,
        provider: "line",
        email: null,
        source_channel: "line",
        can_logout: false,
        can_start_line_oauth: false,
      },
      locale: null,
    }
  }

  const [resolved_visitor_uuid, user, linked_participant] = await Promise.all([
    findVisitorUuidByUser(user_uuid),
    loadLineUser(user_uuid),
    findOldestParticipantByUserUuid(user_uuid),
  ])
  const visitor_uuid =
    resolved_visitor_uuid ??
    line_contact?.visitor_uuid ??
    linked_participant?.visitor_uuid ??
    null

  return {
    user_uuid,
    visitor_uuid,
    identity_uuid: identity?.identity_uuid ?? null,
    session: {
      visitor_uuid,
      user_uuid,
      role: resolveLineRole(user?.role),
      tier: user?.tier ?? "member",
      display_name: user?.display_name ?? null,
      image_url: user?.image_url ?? null,
      provider: "line",
      email: null,
      source_channel: "line",
      can_logout: false,
      can_start_line_oauth: false,
    },
    locale: user?.locale ?? null,
  }
}
