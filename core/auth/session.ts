import { cookies } from "next/headers"

import type { AppSession, AuthContext, SourceChannel } from "@/core/auth/types"

const VISITOR_COOKIE_NAME = "amp_visitor_uuid"
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

type VisitorRecord = {
  visitor_uuid: string
  user_uuid: string | null
  source_channel: SourceChannel
}

type VisitorResolution = {
  visitor: VisitorRecord
  action: "create" | "reuse"
  cookie_found: boolean
}

type VisitorStore = {
  findVisitorByUuid: (visitor_uuid: string) => Promise<VisitorRecord | null>
  touchVisitor: (visitor_uuid: string) => Promise<void>
  createVisitor: (context: AuthContext) => Promise<VisitorRecord>
  resolveUserUuidFromAuth: (context: AuthContext) => Promise<string | null>
  linkVisitorUser: (visitor_uuid: string, user_uuid: string) => Promise<void>
}

type SupabaseConfig = {
  url: string
  key: string
}

type AuthUserResponse = {
  id?: string
}

type UserUuidRow = {
  user_uuid?: string | null
}

const runtimeVisitors = new Map<string, VisitorRecord>()

// TEMP_AUTH_DEBUG
async function send_auth_debug(
  event: string,
  payload: Record<string, unknown>,
) {
  if (
    process.env.DEBUG_CAT_SWITCH !== "true" ||
    !process.env.DEBUG_CAT_WEBHOOK
  ) {
    return
  }

  try {
    await fetch(process.env.DEBUG_CAT_WEBHOOK, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "AUTH SESSION",
        content:
          "[DEBUG] AUTH_SESSION\n" +
          "```json\n" +
          JSON.stringify(
            {
              event,
              ...payload,
            },
            null,
            2,
          ) +
          "\n```",
      }),
    })
  } catch (error) {
    console.error("TEMP_AUTH_DEBUG_FAILED", error)
  }
}

function getSupabaseConfig(): SupabaseConfig | null {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    null

  if (!url || !key) {
    return null
  }

  return {
    url: url.replace(/\/$/, ""),
    key,
  }
}

function restHeaders(config: SupabaseConfig) {
  return {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    "Content-Type": "application/json",
  }
}

function restUrl(config: SupabaseConfig, table: string, query: string) {
  return `${config.url}/rest/v1/${table}?${query}`
}

async function readFirstRow<T>(response: Response): Promise<T | null> {
  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as T[]

  return rows[0] ?? null
}

async function fetchFirstRow<T>(
  config: SupabaseConfig,
  table: string,
  query: string,
): Promise<T | null> {
  const response = await fetch(restUrl(config, table, query), {
    headers: restHeaders(config),
    cache: "no-store",
  })

  return readFirstRow<T>(response)
}

function visitorQuery(visitor_uuid: string) {
  return [
    `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`,
    "select=visitor_uuid,user_uuid,source_channel",
    "limit=1",
  ].join("&")
}

async function resolveAuthUserId(
  config: SupabaseConfig,
  auth_token: string | null,
) {
  if (!auth_token) {
    return null
  }

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${auth_token}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const user = (await response.json()) as AuthUserResponse

  return user.id ?? null
}

async function resolveUserUuidFromIdentities(
  config: SupabaseConfig,
  authUserId: string,
) {
  const filter = encodeURIComponent(
    `(auth_user_uuid.eq.${authUserId},provider_user_uuid.eq.${authUserId},external_user_id.eq.${authUserId})`,
  )
  const row = await fetchFirstRow<UserUuidRow>(
    config,
    "identities",
    [`or=${filter}`, "select=user_uuid", "limit=1"].join("&"),
  )

  return row?.user_uuid ?? null
}

async function resolveUserUuidFromUsers(
  config: SupabaseConfig,
  authUserId: string,
) {
  const row = await fetchFirstRow<UserUuidRow>(
    config,
    "users",
    [
      `auth_user_uuid=eq.${encodeURIComponent(authUserId)}`,
      "select=user_uuid",
      "limit=1",
    ].join("&"),
  )

  return row?.user_uuid ?? null
}

const supabaseVisitorStore: VisitorStore = {
  async findVisitorByUuid(visitor_uuid) {
    const config = getSupabaseConfig()

    if (!config) {
      return runtimeVisitorStore.findVisitorByUuid(visitor_uuid)
    }

    return fetchFirstRow<VisitorRecord>(config, "visitors", visitorQuery(visitor_uuid))
  },

  async touchVisitor(visitor_uuid) {
    const config = getSupabaseConfig()

    if (!config) {
      return runtimeVisitorStore.touchVisitor(visitor_uuid)
    }

    await fetch(
      restUrl(
        config,
        "visitors",
        `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`,
      ),
      {
        method: "PATCH",
        headers: restHeaders(config),
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
        cache: "no-store",
      },
    )
  },

  async createVisitor(context) {
    const config = getSupabaseConfig()

    if (!config) {
      return runtimeVisitorStore.createVisitor(context)
    }

    const response = await fetch(
      restUrl(config, "visitors", "select=visitor_uuid,user_uuid,source_channel"),
      {
        method: "POST",
        headers: {
          ...restHeaders(config),
          Prefer: "return=representation",
        },
        body: JSON.stringify({ source_channel: context.source_channel }),
        cache: "no-store",
      },
    )
    const visitor = await readFirstRow<VisitorRecord>(response)

    if (!visitor) {
      throw new Error("Failed to create visitor record.")
    }

    return visitor
  },

  async resolveUserUuidFromAuth(context) {
    const config = getSupabaseConfig()

    if (!config) {
      return null
    }

    const authUserId = await resolveAuthUserId(config, context.auth_token)

    if (!authUserId) {
      return null
    }

    return (
      (await resolveUserUuidFromIdentities(config, authUserId)) ??
      (await resolveUserUuidFromUsers(config, authUserId))
    )
  },

  async linkVisitorUser(visitor_uuid, user_uuid) {
    const config = getSupabaseConfig()

    if (!config) {
      return runtimeVisitorStore.linkVisitorUser(visitor_uuid, user_uuid)
    }

    await fetch(
      restUrl(
        config,
        "visitors",
        `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`,
      ),
      {
        method: "PATCH",
        headers: restHeaders(config),
        body: JSON.stringify({
          user_uuid,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      },
    )
  },
}

const runtimeVisitorStore: VisitorStore = {
  async findVisitorByUuid(visitor_uuid) {
    return runtimeVisitors.get(visitor_uuid) ?? null
  },

  async touchVisitor(visitor_uuid) {
    const visitor = runtimeVisitors.get(visitor_uuid)

    if (visitor) {
      runtimeVisitors.set(visitor_uuid, visitor)
    }
  },

  async createVisitor(context) {
    const visitor: VisitorRecord = {
      visitor_uuid: crypto.randomUUID(),
      user_uuid: null,
      source_channel: context.source_channel,
    }

    runtimeVisitors.set(visitor.visitor_uuid, visitor)

    return visitor
  },

  async resolveUserUuidFromAuth() {
    return null
  },

  async linkVisitorUser(visitor_uuid, user_uuid) {
    const visitor = runtimeVisitors.get(visitor_uuid)

    if (!visitor) {
      return
    }

    runtimeVisitors.set(visitor_uuid, {
      ...visitor,
      user_uuid,
    })
  },
}

async function setVisitorCookie(visitor_uuid: string) {
  try {
    const cookieStore = await cookies()

    cookieStore.set(VISITOR_COOKIE_NAME, visitor_uuid, {
      httpOnly: true,
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
  } catch {
    // Cookie writes are only available in response-capable server contexts.
  }
}

async function getVisitorCookie() {
  const cookieStore = await cookies()

  return cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? null
}

async function resolveVisitorRecord(
  context: AuthContext,
  visitorStore: VisitorStore,
): Promise<VisitorResolution> {
  const visitor_uuid = await getVisitorCookie()
  const cookie_found = Boolean(visitor_uuid)

  await send_auth_debug("visitor_cookie_read", {
    cookie_found,
    cookie_value: visitor_uuid,
  })

  if (visitor_uuid) {
    const existingVisitor = await visitorStore.findVisitorByUuid(visitor_uuid)
    const found = Boolean(existingVisitor)

    await send_auth_debug("visitor_lookup", {
      visitor_uuid,
      found,
    })

    if (existingVisitor) {
      await visitorStore.touchVisitor(existingVisitor.visitor_uuid)

      await send_auth_debug("visitor_reused", {
        visitor_uuid: existingVisitor.visitor_uuid,
      })

      return {
        visitor: existingVisitor,
        action: "reuse",
        cookie_found,
      }
    }
  }

  const visitor = await visitorStore.createVisitor(context)
  await setVisitorCookie(visitor.visitor_uuid)

  await send_auth_debug("visitor_created", {
    visitor_uuid: visitor.visitor_uuid,
  })

  return {
    visitor,
    action: "create",
    cookie_found,
  }
}

export async function resolveSession(
  context: AuthContext,
  visitorStore: VisitorStore = supabaseVisitorStore,
): Promise<AppSession> {
  const visitorResolution = await resolveVisitorRecord(context, visitorStore)
  const visitor = visitorResolution.visitor
  const user_uuid = await visitorStore.resolveUserUuidFromAuth(context)

  if (user_uuid && visitor.user_uuid !== user_uuid) {
    await visitorStore.linkVisitorUser(visitor.visitor_uuid, user_uuid)
  }

  const session: AppSession = {
    visitor_uuid: visitor.visitor_uuid,
    user_uuid: user_uuid ?? visitor.user_uuid,
    source_channel: context.source_channel,
  }

  await send_auth_debug("session_built", {
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    source_channel: session.source_channel,
  })

  await send_auth_debug("request_summary", {
    pathname: context.requested_route,
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    cookie_found: visitorResolution.cookie_found,
    action: visitorResolution.action,
  })

  return session
}

export type { AppSession, VisitorStore }
export type { Session } from "@/core/auth/types"

/** @deprecated Use resolveSession instead */
export async function getAuthSession(context: AuthContext): Promise<AppSession> {
  return resolveSession(context)
}
