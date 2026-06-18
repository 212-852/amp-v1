import type { AppSession } from "@/core/auth/session"
import { findVisitorUuidByUser } from "@/core/chat/archive"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { randomUUID } from "crypto"

type UserRow = {
  role?: string
  tier?: string
  display_name?: string | null
  image_url?: string | null
  locale?: string | null
}

type IdentityRow = {
  user_uuid?: string | null
}

type ContactVisitorRow = {
  visitor_uuid?: string | null
}

type VisitorRow = {
  visitor_uuid?: string | null
}

export type LineWebhookAccess = {
  user_uuid: string | null
  visitor_uuid: string | null
  session: AppSession | null
  locale: string | null
  reply_enabled: boolean
  reply_allowed: boolean
  reply_reason: string
}

export function get_allowed_line_users() {
  return (process.env.LINE_WEBHOOK_ALLOWED_USERS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
}

function lineWebhookReplyEnabled() {
  return process.env.LINE_WEBHOOK_REPLY_ENABLED === "true"
}

export function can_reply_to_line_user(provider_user_id: string) {
  return (
    lineWebhookReplyEnabled() &&
    get_allowed_line_users().includes(provider_user_id.trim())
  )
}

function resolveReplyReason(provider_user_id: string) {
  if (!lineWebhookReplyEnabled()) {
    return "reply_disabled"
  }

  if (!get_allowed_line_users().includes(provider_user_id.trim())) {
    return "provider_user_not_allowed"
  }

  return "allowed"
}

export async function resolveLineUserUuid(provider_user_id: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "identities",
      [
        "provider=eq.line",
        `provider_user_id=eq.${encodeURIComponent(provider_user_id)}`,
        "select=user_uuid",
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

  const rows = (await response.json()) as IdentityRow[]
  return rows[0]?.user_uuid ?? null
}

async function findVisitorUuidByLineContact(provider_user_id: string) {
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
        "visitor_uuid=not.is.null",
        "select=visitor_uuid",
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

  const rows = (await response.json()) as ContactVisitorRow[]
  return rows[0]?.visitor_uuid ?? null
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

async function resolveLineVisitorUuid(provider_user_id: string) {
  const existing = await findVisitorUuidByLineContact(provider_user_id)

  if (existing) {
    return existing
  }

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

export async function resolveLineWebhookAccess(
  provider_user_id: string,
): Promise<LineWebhookAccess> {
  const user_uuid = await resolveLineUserUuid(provider_user_id)
  const reply_allowed = can_reply_to_line_user(provider_user_id)
  const reply_reason = resolveReplyReason(provider_user_id)

  if (!user_uuid) {
    const visitor_uuid = await resolveLineVisitorUuid(provider_user_id)

    return {
      user_uuid: null,
      visitor_uuid,
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
      reply_enabled: lineWebhookReplyEnabled(),
      reply_allowed,
      reply_reason,
    }
  }

  const [visitor_uuid, user] = await Promise.all([
    findVisitorUuidByUser(user_uuid),
    loadLineUser(user_uuid),
  ])
  const session: AppSession = {
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
  }

  return {
    user_uuid,
    visitor_uuid,
    session,
    locale: user?.locale ?? null,
    reply_enabled: lineWebhookReplyEnabled(),
    reply_allowed,
    reply_reason,
  }
}
