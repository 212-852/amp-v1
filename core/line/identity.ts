import type { AppSession } from "@/core/auth/session"
import { resolveIdentityByProviderUserId } from "@/core/auth/identity"
import {
  findOldestParticipantByUserUuid,
  findVisitorUuidByUser,
} from "@/core/chat/archive"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { randomUUID } from "crypto"

type UserRow = {
  role?: string
  tier?: string
  display_name?: string | null
  image_url?: string | null
  locale?: string | null
}

type VisitorRow = {
  visitor_uuid?: string | null
}

export type StableLineIdentity = {
  provider_user_id: string
  user_uuid: string | null
  visitor_uuid: string | null
  identity_uuid: string | null
  locale: string | null
  session: AppSession
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

async function resolveVisitorUuidForUser(user_uuid: string) {
  const from_visitor_table = await findVisitorUuidByUser(user_uuid)

  if (from_visitor_table) {
    return from_visitor_table
  }

  const participant = await findOldestParticipantByUserUuid(user_uuid)
  return participant?.visitor_uuid ?? null
}

export async function resolve_user_has_line_identity(
  user_uuid: string | null | undefined,
): Promise<boolean> {
  if (!user_uuid) {
    return false
  }

  const config = getRestConfig()

  if (!config) {
    return false
  }

  const response = await fetch(
    restUrl(
      config,
      "identities",
      `user_uuid=eq.${encodeURIComponent(user_uuid)}&provider=eq.line&select=identity_uuid&limit=1`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return false
  }

  const rows = (await response.json()) as Array<{ identity_uuid?: string | null }>
  return rows.length > 0
}

export async function resolveStableLineIdentity(
  provider_user_id: string,
): Promise<StableLineIdentity> {
  const identity = await resolveIdentityByProviderUserId({
    provider: "line",
    provider_user_id,
  })
  const user_uuid = identity?.user_uuid ?? null

  let visitor_uuid: string | null = null

  if (user_uuid) {
    visitor_uuid = visitor_uuid ?? (await resolveVisitorUuidForUser(user_uuid))

    if (!visitor_uuid) {
      visitor_uuid = await createLineVisitor()
    }

    const user = await loadLineUser(user_uuid)

    return {
      provider_user_id,
      user_uuid,
      visitor_uuid,
      identity_uuid: identity?.identity_uuid ?? null,
      locale: user?.locale ?? null,
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
    }
  }

  if (!visitor_uuid) {
    visitor_uuid = await createLineVisitor()
  }

  return {
    provider_user_id,
    user_uuid: null,
    visitor_uuid,
    identity_uuid: identity?.identity_uuid ?? null,
    locale: null,
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
  }
}
