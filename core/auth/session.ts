import { cache } from "react"

import { resolveAuthContext } from "@/core/auth/context"
import type { AppSession, AuthContext, SourceChannel } from "@/core/auth/types"

const VISITOR_COOKIE_NAME = "amp_visitor_uuid"
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const TEMP_AUTH_DEBUG_OWNER_ID = "1475072657505648701"

type VisitorRecord = {
  visitor_uuid: string
  user_uuid: string | null
  source_channel: SourceChannel
}

type VisitorResolution = {
  visitor: VisitorRecord
  action: VisitorAction
  cookie_found: boolean
  cookie_value: string | null
  created_new_visitor: boolean
}

type VisitorAction = "create" | "reuse" | "repair"

type CookieOptions = {
  httpOnly: boolean
  maxAge: number
  path: string
  sameSite: "lax"
  secure: boolean
}

type SessionRuntime = {
  request_id?: string | null
  cookie_value?: string | null
  cookie_was_found?: boolean
  request_cache_key?: string | null
  search?: string | null
  user_agent_contains_line?: boolean
  cookie_set_done?: boolean
  set_cookie?: (
    name: string,
    value: string,
    options: CookieOptions,
  ) => void | Promise<void>
  pathname?: string | null
  resolved_session?: AppSession | null
}

type SessionCacheEntry = {
  session: AppSession
  visitor_action: VisitorAction
  created_new_visitor: boolean
  cookie_found: boolean
  cookie_value: string | null
}

type VisitorStore = {
  findVisitorByUuid: (visitor_uuid: string) => Promise<VisitorRecord | null>
  touchVisitor: (visitor_uuid: string) => Promise<void>
  upsertVisitor: (
    context: AuthContext,
    visitor_uuid: string,
  ) => Promise<VisitorRecord>
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
const requestSessionPromises = new Map<string, Promise<SessionCacheEntry>>()

const visitorCookieOptions: CookieOptions = {
  httpOnly: true,
  maxAge: VISITOR_COOKIE_MAX_AGE,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
}

// TEMP_AUTH_DEBUG
async function send_auth_debug(
  event: string,
  payload: Record<string, unknown>,
  request_id?: string | null,
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
          `<@${TEMP_AUTH_DEBUG_OWNER_ID}>\n` +
          "[DEBUG] AUTH_SESSION\n" +
          `event: ${event}\n` +
          "```json\n" +
          JSON.stringify(
            {
              event,
              request_id: request_id ?? null,
              ...payload,
            },
            null,
            2,
          ) +
          "\n```",
        allowed_mentions: {
          users: [TEMP_AUTH_DEBUG_OWNER_ID],
        },
      }),
    })
  } catch (error) {
    console.error("TEMP_AUTH_DEBUG_FAILED", error)
  }
}

async function resolveRequestId(runtime?: SessionRuntime): Promise<string> {
  if (runtime?.request_id) {
    return runtime.request_id
  }

  try {
    const { headers } = await import("next/headers")
    const requestHeaders = await headers()
    const headerRequestId = requestHeaders.get("x-amp-request-id")

    if (headerRequestId) {
      return headerRequestId
    }
  } catch {
    // headers unavailable outside request scope
  }

  return crypto.randomUUID()
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

  async upsertVisitor(context, visitor_uuid) {
    const config = getSupabaseConfig()

    if (!config) {
      return runtimeVisitorStore.upsertVisitor(context, visitor_uuid)
    }

    const response = await fetch(
      restUrl(
        config,
        "visitors",
        "on_conflict=visitor_uuid&select=visitor_uuid,user_uuid,source_channel",
      ),
      {
        method: "POST",
        headers: {
          ...restHeaders(config),
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify({
          visitor_uuid,
          source_channel: context.source_channel,
          updated_at: new Date().toISOString(),
          user_uuid: null,
        }),
        cache: "no-store",
      },
    )
    const visitor = await readFirstRow<VisitorRecord>(response)

    if (!visitor) {
      throw new Error("Failed to upsert visitor record.")
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

  async upsertVisitor(context, visitor_uuid) {
    const visitor: VisitorRecord = {
      visitor_uuid,
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

async function getRequestVisitorCookie(runtime?: SessionRuntime) {
  if (runtime && "cookie_value" in runtime) {
    return runtime.cookie_value ?? null
  }

  try {
    const { cookies, headers } = await import("next/headers")
    const [cookieStore, requestHeaders] = await Promise.all([
      cookies(),
      headers(),
    ])

    return (
      cookieStore.get(VISITOR_COOKIE_NAME)?.value ??
      requestHeaders.get("x-amp-session-visitor-uuid") ??
      null
    )
  } catch {
    return null
  }
}

async function setVisitorCookie(
  visitor_uuid: string,
  runtime?: SessionRuntime,
  request_id?: string | null,
) {
  if (runtime?.cookie_set_done) {
    return
  }

  if (runtime?.set_cookie) {
    await runtime.set_cookie(
      VISITOR_COOKIE_NAME,
      visitor_uuid,
      visitorCookieOptions,
    )
    runtime.cookie_set_done = true
    await send_auth_debug(
      "visitor_cookie_set",
      {
        visitor_uuid,
        pathname: runtime.pathname ?? null,
        cookie_name: VISITOR_COOKIE_NAME,
        path: visitorCookieOptions.path,
        max_age: visitorCookieOptions.maxAge,
        secure: visitorCookieOptions.secure,
      },
      request_id,
    )
    return
  }

  try {
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()

    cookieStore.set(VISITOR_COOKIE_NAME, visitor_uuid, visitorCookieOptions)
    if (runtime) {
      runtime.cookie_set_done = true
    }
    await send_auth_debug(
      "visitor_cookie_set",
      {
        visitor_uuid,
        pathname: runtime?.pathname ?? null,
        cookie_name: VISITOR_COOKIE_NAME,
        path: visitorCookieOptions.path,
        max_age: visitorCookieOptions.maxAge,
        secure: visitorCookieOptions.secure,
      },
      request_id,
    )
  } catch {
    // TEMP_AUTH_DEBUG Cookie writes require a response-capable server context.
  }
}

async function resolveVisitorRecord(
  context: AuthContext,
  visitorStore: VisitorStore,
  runtime?: SessionRuntime,
  request_id?: string | null,
): Promise<VisitorResolution> {
  const cookie_value = await getRequestVisitorCookie(runtime)
  const cookie_found = Boolean(cookie_value)
  const pathname = runtime?.pathname ?? context.requested_route ?? null

  await send_auth_debug(
    "visitor_cookie_read",
    {
      pathname,
      cookie_found,
      cookie_value: cookie_found ? cookie_value : null,
    },
    request_id,
  )

  if (cookie_value) {
    const existingVisitor = await visitorStore.findVisitorByUuid(cookie_value)
    const found = Boolean(existingVisitor)

    await send_auth_debug(
      "visitor_lookup",
      {
        pathname,
        visitor_uuid: cookie_value,
        found,
      },
      request_id,
    )

    if (existingVisitor) {
      await visitorStore.touchVisitor(existingVisitor.visitor_uuid)

      await send_auth_debug(
        "visitor_reused",
        {
          pathname,
          visitor_uuid: existingVisitor.visitor_uuid,
          created_new_visitor: false,
        },
        request_id,
      )

      return {
        visitor: existingVisitor,
        action: "reuse",
        cookie_found,
        cookie_value,
        created_new_visitor: false,
      }
    }

    const visitor = await visitorStore.upsertVisitor(context, cookie_value)

    await send_auth_debug(
      "visitor_upserted",
      {
        pathname,
        visitor_uuid: visitor.visitor_uuid,
        source_channel: visitor.source_channel,
      },
      request_id,
    )

    await send_auth_debug(
      "visitor_repaired",
      {
        pathname,
        old_cookie_value: cookie_value,
        visitor_uuid: visitor.visitor_uuid,
        created_new_visitor: false,
      },
      request_id,
    )

    return {
      visitor,
      action: "repair",
      cookie_found,
      cookie_value,
      created_new_visitor: false,
    }
  }

  await send_auth_debug(
    "visitor_create_start",
    {
      pathname,
    },
    request_id,
  )

  const visitor_uuid = crypto.randomUUID()
  const visitor = await visitorStore.upsertVisitor(context, visitor_uuid)
  await setVisitorCookie(visitor.visitor_uuid, runtime, request_id)

  await send_auth_debug(
    "visitor_upserted",
    {
      pathname,
      visitor_uuid: visitor.visitor_uuid,
      source_channel: visitor.source_channel,
    },
    request_id,
  )

  await send_auth_debug(
    "visitor_create_finish",
    {
      pathname,
      visitor_uuid: visitor.visitor_uuid,
    },
    request_id,
  )

  await send_auth_debug(
    "visitor_created",
    {
      pathname,
      visitor_uuid: visitor.visitor_uuid,
      created_new_visitor: true,
    },
    request_id,
  )

  await send_auth_debug(
    "visitor_created_forensic",
    {
      visitor_uuid: visitor.visitor_uuid,
      pathname,
      request_id: request_id ?? null,
      stack: new Error("TEMP_AUTH_DEBUG_VISITOR_CREATED").stack ?? null,
    },
    request_id,
  )

  return {
    visitor,
    action: "create",
    cookie_found,
    cookie_value: null,
    created_new_visitor: true,
  }
}

function buildRequestSummary(
  session: AppSession,
  resolution: VisitorResolution,
  runtime?: SessionRuntime,
  context?: AuthContext,
) {
  return {
    visitor_action: resolution.action,
    created_new_visitor: resolution.created_new_visitor,
    visitor_uuid: session.visitor_uuid,
    source_channel: session.source_channel,
    cookie_found: resolution.cookie_found,
    cookie_value: resolution.cookie_value,
    pathname: runtime?.pathname ?? context?.requested_route ?? null,
    user_uuid: session.user_uuid,
  }
}

async function resolve_session_context_core(
  context: AuthContext,
  visitorStore: VisitorStore,
  runtime?: SessionRuntime,
  request_id?: string | null,
): Promise<SessionCacheEntry> {
  const visitorResolution = await resolveVisitorRecord(
    context,
    visitorStore,
    runtime,
    request_id,
  )
  const visitor = visitorResolution.visitor
  const user_uuid = await visitorStore.resolveUserUuidFromAuth(context)
  const pathname = runtime?.pathname ?? context.requested_route ?? null

  if (user_uuid && visitor.user_uuid !== user_uuid) {
    await visitorStore.linkVisitorUser(visitor.visitor_uuid, user_uuid)
    await send_auth_debug(
      "visitor_user_linked",
      {
        pathname,
        visitor_uuid: visitor.visitor_uuid,
        user_uuid,
      },
      request_id,
    )
  }

  const session: AppSession = {
    visitor_uuid: visitor.visitor_uuid,
    user_uuid: user_uuid ?? visitor.user_uuid,
    source_channel: context.source_channel,
  }

  await send_auth_debug(
    "session_built",
    {
      pathname,
      visitor_uuid: session.visitor_uuid,
      user_uuid: session.user_uuid,
      source_channel: session.source_channel,
    },
    request_id,
  )

  await send_auth_debug(
    "request_summary",
    buildRequestSummary(session, visitorResolution, runtime, context),
    request_id,
  )

  return {
    session,
    visitor_action: visitorResolution.action,
    created_new_visitor: visitorResolution.created_new_visitor,
    cookie_found: visitorResolution.cookie_found,
    cookie_value: visitorResolution.cookie_value,
  }
}

const resolve_session_context_rsc = cache(
  async (request_id: string): Promise<SessionCacheEntry> => {
    const context = await resolveAuthContext()
    const pathname = context.requested_route

    await send_auth_debug(
      "resolve_session_enter",
      {
        pathname,
        cookie_value: null,
        entry: "resolve_session_context_rsc",
      },
      request_id,
    )

    const cached = await resolve_session_context_core(
      context,
      supabaseVisitorStore,
      { pathname, request_id },
      request_id,
    )

    await send_auth_debug(
      "resolve_session_exit",
      {
        pathname,
        visitor_uuid: cached.session.visitor_uuid,
        source_channel: cached.session.source_channel,
        entry: "resolve_session_context_rsc",
      },
      request_id,
    )

    return cached
  },
)

const resolveSessionCached = cache(async (request_id: string): Promise<AppSession> => {
  const cached = await resolve_session_context_rsc(request_id)
  return cached.session
})

export async function resolve_session_context(
  context: AuthContext,
  visitorStore: VisitorStore = supabaseVisitorStore,
  runtime?: SessionRuntime,
): Promise<AppSession> {
  const request_id = await resolveRequestId(runtime)
  const pathname = runtime?.pathname ?? context.requested_route ?? null
  const cookie_value = await getRequestVisitorCookie(runtime)

  if (runtime) {
    runtime.request_id = request_id
  }

  await send_auth_debug(
    "resolve_session_enter",
    {
      pathname,
      cookie_value: cookie_value ?? null,
      entry: runtime?.request_cache_key ? "proxy" : "direct",
      request_cache_key: runtime?.request_cache_key ?? null,
    },
    request_id,
  )

  if (runtime?.resolved_session) {
    await send_auth_debug(
      "resolve_session_exit",
      {
        pathname,
        visitor_uuid: runtime.resolved_session.visitor_uuid,
        source_channel: runtime.resolved_session.source_channel,
        entry: "resolved_session_short_circuit",
      },
      request_id,
    )
    return runtime.resolved_session
  }

  if (runtime?.request_cache_key) {
    const existingPromise = requestSessionPromises.get(runtime.request_cache_key)

    if (existingPromise) {
      await send_auth_debug(
        "request_cache_hit",
        {
          pathname,
          request_cache_key: runtime.request_cache_key,
        },
        request_id,
      )

      const cached = await existingPromise

      await send_auth_debug(
        "request_summary",
        {
          ...buildRequestSummary(
            cached.session,
            {
              visitor: {
                visitor_uuid: cached.session.visitor_uuid,
                user_uuid: cached.session.user_uuid,
                source_channel: cached.session.source_channel,
              },
              action: cached.visitor_action,
              cookie_found: cached.cookie_found,
              cookie_value: cached.cookie_value,
              created_new_visitor: cached.created_new_visitor,
            },
            runtime,
            context,
          ),
          request_cache_hit: true,
        },
        request_id,
      )

      await send_auth_debug(
        "resolve_session_exit",
        {
          pathname,
          visitor_uuid: cached.session.visitor_uuid,
          source_channel: cached.session.source_channel,
          entry: "request_cache_hit",
        },
        request_id,
      )

      return cached.session
    }

    const promise = resolve_session_context_core(
      context,
      visitorStore,
      runtime,
      request_id,
    )
    requestSessionPromises.set(runtime.request_cache_key, promise)

    try {
      const cached = await promise

      await send_auth_debug(
        "resolve_session_exit",
        {
          pathname,
          visitor_uuid: cached.session.visitor_uuid,
          source_channel: cached.session.source_channel,
          entry: "proxy_core",
        },
        request_id,
      )

      return cached.session
    } finally {
      requestSessionPromises.delete(runtime.request_cache_key)
    }
  }

  if (visitorStore !== supabaseVisitorStore) {
    const cached = await resolve_session_context_core(
      context,
      visitorStore,
      runtime,
      request_id,
    )

    await send_auth_debug(
      "resolve_session_exit",
      {
        pathname,
        visitor_uuid: cached.session.visitor_uuid,
        source_channel: cached.session.source_channel,
        entry: "custom_visitor_store",
      },
      request_id,
    )

    return cached.session
  }

  const cached = await resolve_session_context_rsc(request_id)

  await send_auth_debug(
    "resolve_session_exit",
    {
      pathname,
      visitor_uuid: cached.session.visitor_uuid,
      source_channel: cached.session.source_channel,
      entry: "rsc_cache",
    },
    request_id,
  )

  return cached.session
}

export async function resolveSession(
  context: AuthContext,
  visitorStore: VisitorStore = supabaseVisitorStore,
): Promise<AppSession> {
  const request_id = await resolveRequestId()
  const session = await getResolvedSessionFromRequestHeaders()

  if (session) {
    await send_auth_debug(
      "resolve_session_exit",
      {
        pathname: context.requested_route,
        visitor_uuid: session.visitor_uuid,
        source_channel: session.source_channel,
        entry: "resolveSession_header_hit",
      },
      request_id,
    )
    return session
  }

  if (visitorStore !== supabaseVisitorStore) {
    return resolve_session_context(context, visitorStore)
  }

  return resolveSessionCached(request_id)
}

async function getResolvedSessionFromRequestHeaders(): Promise<AppSession | null> {
  try {
    const { headers } = await import("next/headers")
    const requestHeaders = await headers()
    const visitor_uuid = requestHeaders.get("x-amp-session-visitor-uuid")
    const source_channel = requestHeaders.get(
      "x-amp-session-source-channel",
    ) as SourceChannel | null

    if (!visitor_uuid || !source_channel) {
      return null
    }

    return {
      visitor_uuid,
      user_uuid: requestHeaders.get("x-amp-session-user-uuid"),
      source_channel,
    }
  } catch {
    return null
  }
}

export { VISITOR_COOKIE_NAME, visitorCookieOptions }
export type { AppSession, CookieOptions, SessionRuntime, VisitorStore }
export type { Session } from "@/core/auth/types"

/** @deprecated Use resolveSession instead */
export async function getAuthSession(context: AuthContext): Promise<AppSession> {
  return resolveSession(context)
}
