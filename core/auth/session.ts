import { cache } from "react"

import { resolveAuthContext } from "@/core/auth/context"
import { resolve_line_user_id } from "@/core/auth/identity"
import type {
  AppSession,
  AuthContext,
  LiffSessionInfo,
  SessionProvider,
  SessionRole,
  SessionTier,
  SourceChannel,
} from "@/core/auth/types"
import { sendAuthDebug as send_auth_debug } from "@/core/debug"
import { resolve_profile_name } from "@/core/profile/rules"

export const VISITOR_COOKIE_NAME = "amp_visitor_uuid"
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
export const AUTH_LOGGED_OUT_COOKIE_NAME = "amp_auth_logged_out"
export const SOURCE_CHANNEL_COOKIE_NAME = "amp_source_channel"
export const SOURCE_CHANNEL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

type VisitorRecord = {
  visitor_uuid: string
  user_uuid: string | null
  source_channel: SourceChannel
}

type VisitorResolution = {
  visitor: VisitorRecord | null
  visitor_uuid: string | null
  action: VisitorAction
  cookie_found: boolean
  cookie_value: string | null
  created_new_visitor: boolean
}

type VisitorAction = "reuse" | "repair" | "create"

type VisitorLookupResult = {
  visitor: VisitorRecord | null
  data: VisitorRecord | null
  error_code: string | null
  error_message: string | null
  error_details: string | null
}

type VisitorDebugContext = {
  pathname: string | null
  request_id: string | null
}

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
  auth_logged_out?: boolean
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

type SessionProfile = {
  role: SessionRole
  tier: SessionTier
  display_name: string | null
  image_url: string | null
  provider: SessionProvider | null
  provider_user_id: string | null
  email: string | null
}

type UserProfileRow = {
  role?: string | null
  tier?: string | null
  name?: string | null
  display_name?: string | null
  image_url?: string | null
}

type ProfileNameRow = {
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
}

type IdentityProfileRow = {
  provider?: string | null
  provider_user_id?: string | null
  email?: string | null
}

type VisitorStore = {
  findVisitorByUuid: (visitor_uuid: string) => Promise<VisitorLookupResult>
  touchVisitor: (visitor_uuid: string) => Promise<void>
  upsertVisitor: (
    context: AuthContext,
    visitor_uuid: string,
    debug: VisitorDebugContext,
  ) => Promise<VisitorRecord>
  resolveUserUuidFromAuth: (context: AuthContext) => Promise<string | null>
  resolveUserUuidFromConsumedOtp: (visitor_uuid: string) => Promise<string | null>
  linkVisitorUser: (visitor_uuid: string, user_uuid: string) => Promise<void>
}

type SupabaseConfig = {
  url: string
  key: string
}

type AuthUserResponse = {
  id?: string
  user_metadata?: {
    sub?: string | null
  } | null
}

type UserUuidRow = {
  user_uuid?: string | null
}

type PostgrestError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

type VisitorUpsertBody = {
  visitor_uuid: string
  source_channel: SourceChannel
  updated_at: string
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

const authLoggedOutCookieOptions: CookieOptions = {
  ...visitorCookieOptions,
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

export async function resolveRequestIdFromHeaders(
  runtime?: SessionRuntime,
): Promise<string> {
  return resolveRequestId(runtime)
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

async function fetchVisitorLookupResult(
  config: SupabaseConfig,
  visitor_uuid: string,
): Promise<VisitorLookupResult> {
  const response = await fetch(
    restUrl(config, "visitors", visitorQuery(visitor_uuid)),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as PostgrestError

    return {
      visitor: null,
      data: null,
      error_code: error.code ?? null,
      error_message: error.message ?? null,
      error_details: error.details ?? null,
    }
  }

  const rows = (await response.json()) as VisitorRecord[]
  const visitor = rows[0] ?? null

  return {
    visitor,
    data: visitor,
    error_code: null,
    error_message: null,
    error_details: null,
  }
}

async function upsertVisitorRow(
  config: SupabaseConfig,
  body: VisitorUpsertBody,
): Promise<{
  visitor: VisitorRecord | null
  error: PostgrestError | null
}> {
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
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as PostgrestError

    return {
      visitor: null,
      error,
    }
  }

  const rows = (await response.json()) as VisitorRecord[]

  return {
    visitor: rows[0] ?? null,
    error: null,
  }
}

function visitorQuery(visitor_uuid: string) {
  return [
    `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`,
    "select=visitor_uuid,user_uuid,source_channel",
    "limit=1",
  ].join("&")
}

async function resolveAuthProviderUserIds(
  config: SupabaseConfig,
  auth_token: string | null,
) {
  if (!auth_token) {
    return []
  }

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${auth_token}`,
    },
    cache: "no-store",
  })

  if (!response.ok) {
    return []
  }

  const user = (await response.json()) as AuthUserResponse
  const ids = [user.user_metadata?.sub, user.id].filter(
    (value): value is string => typeof value === "string" && Boolean(value),
  )

  return Array.from(new Set(ids))
}

async function resolveUserUuidFromIdentities(
  config: SupabaseConfig,
  providerUserIds: string[],
) {
  if (!providerUserIds.length) {
    return null
  }

  const filters = providerUserIds.map(
    (providerUserId) =>
      `provider_user_id.eq.${encodeURIComponent(providerUserId)}`,
  )
  const row = await fetchFirstRow<UserUuidRow>(
    config,
    "identities",
    [
      `or=(${filters.join(",")})`,
      "select=user_uuid",
      "limit=1",
    ].join("&"),
  )

  return row?.user_uuid ?? null
}

async function resolveUserUuidFromConsumedOtp(
  config: SupabaseConfig,
  visitor_uuid: string,
) {
  const row = await fetchFirstRow<UserUuidRow>(
    config,
    "otp",
    [
      `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`,
      "user_uuid=not.is.null",
      "consumed_at=not.is.null",
      "select=user_uuid",
      "order=created_at.desc",
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

    return fetchVisitorLookupResult(config, visitor_uuid)
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

  async upsertVisitor(context, visitor_uuid, debug) {
    const config = getSupabaseConfig()

    if (!config) {
      return runtimeVisitorStore.upsertVisitor(context, visitor_uuid, debug)
    }

    const now = new Date().toISOString()
    const body: VisitorUpsertBody = {
      visitor_uuid,
      source_channel: context.source_channel,
      updated_at: now,
    }
    const result = await upsertVisitorRow(config, body)
    const visitor = result.visitor
    const upsertError = result.error

    await send_auth_debug(
      "visitor_upsert_result",
      {
        pathname: debug.pathname,
        visitor_uuid,
        source_channel: context.source_channel,
        data: result.visitor,
        error_code: result.error?.code ?? null,
        error_message: result.error?.message ?? null,
        error_details: result.error?.details ?? null,
        error_hint: result.error?.hint ?? null,
      },
      debug.request_id,
    )

    if (!visitor) {
      await send_auth_debug(
        "visitor_upsert_failed",
        {
          pathname: debug.pathname,
          visitor_uuid,
          source_channel: context.source_channel,
          error_code: upsertError?.code ?? null,
          error_message: upsertError?.message ?? null,
          error_details: upsertError?.details ?? null,
          error_hint: upsertError?.hint ?? null,
        },
        debug.request_id,
      )

      throw new Error(
        `Failed to upsert visitor record: ${upsertError?.code ?? "unknown"} ${
          upsertError?.message ?? "No PostgREST error returned"
        }`,
      )
    }

    return visitor
  },

  async resolveUserUuidFromAuth(context) {
    const config = getSupabaseConfig()

    if (!config) {
      return null
    }

    const providerUserIds = await resolveAuthProviderUserIds(config, context.auth_token)

    if (!providerUserIds.length) {
      return null
    }

    return resolveUserUuidFromIdentities(config, providerUserIds)
  },

  async resolveUserUuidFromConsumedOtp(visitor_uuid) {
    const config = getSupabaseConfig()

    if (!config) {
      return runtimeVisitorStore.resolveUserUuidFromConsumedOtp(visitor_uuid)
    }

    return resolveUserUuidFromConsumedOtp(config, visitor_uuid)
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
    const visitor = runtimeVisitors.get(visitor_uuid) ?? null

    return {
      visitor,
      data: visitor,
      error_code: null,
      error_message: null,
      error_details: null,
    }
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

  async resolveUserUuidFromConsumedOtp() {
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

async function getRequestAuthLoggedOut(runtime?: SessionRuntime) {
  if (runtime && "auth_logged_out" in runtime) {
    return runtime.auth_logged_out === true
  }

  try {
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()

    return cookieStore.get(AUTH_LOGGED_OUT_COOKIE_NAME)?.value === "true"
  } catch {
    return false
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

function buildAnonymousSession(context: AuthContext): AppSession {
  return {
    visitor_uuid: null,
    user_uuid: null,
    role: "guest",
    tier: "guest",
    display_name: null,
    image_url: null,
    provider: null,
    provider_user_id: null,
    email: null,
    source_channel: context.source_channel ?? "web",
    can_logout: false,
    can_start_line_oauth:
      context.source_channel === "web" || context.source_channel === "pwa",
  }
}

function normalizeSessionRole(value: string | null | undefined): SessionRole {
  if (
    value === "admin" ||
    value === "driver" ||
    value === "user" ||
    value === "owner" ||
    value === "concierge"
  ) {
    return value
  }

  return "guest"
}

function normalizeSessionTier(value: string | null | undefined): SessionTier {
  const normalized = normalizeNullableString(value)?.toLowerCase()

  if (!normalized) {
    return "guest"
  }

  return normalized
}

function normalizeSessionProvider(
  value: string | null | undefined,
): SessionProvider | null {
  if (value === "google" || value === "line" || value === "email") {
    return value
  }

  return null
}

function normalizeNullableString(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

async function resolveSessionProfile(user_uuid: string | null): Promise<SessionProfile> {
  if (!user_uuid) {
    return {
      role: "guest",
      tier: "guest",
      display_name: null,
      image_url: null,
      provider: null,
      provider_user_id: null,
      email: null,
    }
  }

  const config = getSupabaseConfig()

  if (!config) {
    return {
      role: "user",
      tier: "member",
      display_name: null,
        image_url: null,
        provider: null,
        provider_user_id: null,
        email: null,
    }
  }

  const userQueryBase = `user_uuid=eq.${encodeURIComponent(user_uuid)}`
  let userResponse = await fetch(
    restUrl(
      config,
      "users",
      [userQueryBase, "select=role,tier,name,image_url", "limit=1"].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!userResponse.ok) {
    userResponse = await fetch(
      restUrl(
        config,
        "users",
        [userQueryBase, "select=role,tier,display_name,image_url", "limit=1"].join("&"),
      ),
      {
        headers: restHeaders(config),
        cache: "no-store",
      },
    )
  }

  const [profileResponse, identityResponse] = await Promise.all([
    fetch(
      restUrl(
        config,
        "profiles",
        [
          userQueryBase,
          "select=nickname,first_name,last_name",
          "limit=1",
        ].join("&"),
      ),
      {
        headers: restHeaders(config),
        cache: "no-store",
      },
    ),
    fetch(
      restUrl(
        config,
        "identities",
        [
          `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
          "select=provider,provider_user_id,email",
          "limit=1",
        ].join("&"),
      ),
      {
        headers: restHeaders(config),
        cache: "no-store",
      },
    ),
  ])

  if (!userResponse.ok) {
    return {
      role: "user",
      tier: "member",
      display_name: null,
      image_url: null,
      provider: null,
      provider_user_id: null,
      email: null,
    }
  }

  const users = (await userResponse.json()) as UserProfileRow[]
  const profiles = profileResponse.ok
    ? ((await profileResponse.json()) as ProfileNameRow[])
    : []
  const identities = identityResponse.ok
    ? ((await identityResponse.json()) as IdentityProfileRow[])
    : []
  const user = users[0]
  const profile = profiles[0]
  const identity = identities[0]

  return {
    role: normalizeSessionRole(user?.role ?? "user"),
    tier: normalizeSessionTier(user?.tier ?? "member"),
    display_name: resolve_profile_name({
      nickname: profile?.nickname,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
      users_name: user?.name ?? user?.display_name,
      fallback: "Guest",
    }),
    image_url: normalizeNullableString(user?.image_url),
    provider: normalizeSessionProvider(identity?.provider),
    provider_user_id: normalizeNullableString(identity?.provider_user_id),
    email: normalizeNullableString(identity?.email),
  }
}

function resolveLogoutVisibility(session: {
  user_uuid: string | null
  source_channel: SourceChannel
}) {
  return Boolean(
    session.user_uuid &&
      (session.source_channel === "web" || session.source_channel === "pwa"),
  )
}

async function resolveLiffSessionInfo(input: {
  source_channel: SourceChannel
  user_uuid: string | null
}): Promise<LiffSessionInfo | null> {
  if (input.source_channel !== "liff") {
    return null
  }

  const provider_user_id = input.user_uuid
    ? await resolve_line_user_id(input.user_uuid)
    : null

  return {
    provider_user_id,
    verified: Boolean(provider_user_id),
  }
}

async function withLogoutVisibility(
  session: Omit<
    AppSession,
    | "can_logout"
    | "can_start_line_oauth"
    | "role"
    | "tier"
    | "display_name"
    | "image_url"
    | "provider"
    | "provider_user_id"
    | "email"
  > & {
    can_logout?: boolean
    can_start_line_oauth?: boolean
    role?: SessionRole
    tier?: SessionTier
    display_name?: string | null
    image_url?: string | null
    provider?: SessionProvider | null
    provider_user_id?: string | null
    email?: string | null
  },
  request_id?: string | null,
): Promise<AppSession> {
  const profile =
    session.role &&
    session.tier &&
    "display_name" in session &&
    "image_url" in session &&
    "provider" in session &&
    "provider_user_id" in session &&
    "email" in session
      ? {
          role: session.role,
          tier: session.tier,
          display_name: session.display_name ?? null,
          image_url: session.image_url ?? null,
          provider: session.provider ?? null,
          provider_user_id: session.provider_user_id ?? null,
          email: session.email ?? null,
        }
      : await resolveSessionProfile(session.user_uuid)
  const resolved: AppSession = {
    ...session,
    role: profile.role,
    tier: profile.tier,
    display_name: profile.display_name,
    image_url: profile.image_url,
    provider: profile.provider,
    provider_user_id: profile.provider_user_id,
    email: profile.email,
    can_logout: resolveLogoutVisibility(session),
    can_start_line_oauth:
      session.source_channel === "web" || session.source_channel === "pwa",
    liff: await resolveLiffSessionInfo({
      source_channel: session.source_channel,
      user_uuid: session.user_uuid,
    }),
  }

  await send_auth_debug(
    "logout_visibility_resolved",
    {
      visitor_uuid: resolved.visitor_uuid,
      user_uuid: resolved.user_uuid,
      source_channel: resolved.source_channel,
      can_logout: resolved.can_logout,
    },
    request_id,
  )

  return resolved
}

function buildFailedSessionCacheEntry(context: AuthContext): SessionCacheEntry {
  const session = buildAnonymousSession(context)

  return {
    session,
    visitor_action: "create",
    created_new_visitor: false,
    cookie_found: false,
    cookie_value: null,
  }
}

async function createVisitorRecord(input: {
  context: AuthContext
  visitorStore: VisitorStore
  runtime?: SessionRuntime
  request_id?: string | null
  pathname: string | null
  reason: string
}): Promise<VisitorResolution> {
  const visitor_uuid = crypto.randomUUID()
  const visitor = await input.visitorStore.upsertVisitor(
    input.context,
    visitor_uuid,
    {
      pathname: input.pathname,
      request_id: input.request_id ?? null,
    },
  )

  await setVisitorCookie(visitor_uuid, input.runtime, input.request_id)

  await send_auth_debug(
    "visitor_created",
    {
      pathname: input.pathname,
      visitor_uuid: visitor.visitor_uuid,
      source_channel: visitor.source_channel,
      reason: input.reason,
      created_new_visitor: true,
    },
    input.request_id,
  )

  return {
    visitor,
    visitor_uuid: visitor.visitor_uuid,
    action: "create",
    cookie_found: false,
    cookie_value: visitor_uuid,
    created_new_visitor: true,
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
    cookie_found ? "session_cookie_found" : "session_cookie_missing",
    {
      pathname,
      visitor_uuid: cookie_found ? cookie_value : null,
      user_uuid: null,
      request_id: request_id ?? null,
    },
    request_id,
  )

  await send_auth_debug(
    "visitor_cookie_read",
    {
      pathname,
      cookie_found,
      cookie_value: cookie_found ? cookie_value : null,
    },
    request_id,
  )

  await send_auth_debug(
    "session_cookie_read",
    {
      pathname,
      cookie_name: VISITOR_COOKIE_NAME,
      cookie_found,
      visitor_uuid: cookie_found ? cookie_value : null,
    },
    request_id,
  )

  if (cookie_value) {
    const lookupResult = await visitorStore.findVisitorByUuid(cookie_value)
    const existingVisitor = lookupResult.visitor
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

    if (!found) {
      await send_auth_debug(
        "visitor_lookup_result",
        {
          pathname,
          visitor_uuid: cookie_value,
          data: lookupResult.data,
          error_code: lookupResult.error_code,
          error_message: lookupResult.error_message,
          error_details: lookupResult.error_details,
        },
        request_id,
      )
    }

    if (existingVisitor) {
      await visitorStore.touchVisitor(existingVisitor.visitor_uuid)

      await send_auth_debug(
        "visitor_reused",
        {
          pathname,
          visitor_uuid: existingVisitor.visitor_uuid,
          user_uuid: existingVisitor.user_uuid,
          request_id: request_id ?? null,
          created_new_visitor: false,
        },
        request_id,
      )

      return {
        visitor: existingVisitor,
        visitor_uuid: existingVisitor.visitor_uuid,
        action: "reuse",
        cookie_found,
        cookie_value,
        created_new_visitor: false,
      }
    }

    const visitor = await visitorStore.upsertVisitor(context, cookie_value, {
      pathname,
      request_id: request_id ?? null,
    })

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

    const repairLookup = await visitorStore.findVisitorByUuid(cookie_value)

    await send_auth_debug(
      "visitor_repair_verify",
      {
        visitor_uuid: cookie_value,
        found_after_repair: Boolean(repairLookup.visitor),
        error_code: repairLookup.error_code,
        error_message: repairLookup.error_message,
        error_details: repairLookup.error_details,
        error: repairLookup.error_message,
      },
      request_id,
    )

    return {
      visitor,
      visitor_uuid: visitor.visitor_uuid,
      action: "repair",
      cookie_found,
      cookie_value,
      created_new_visitor: false,
    }
  }

  return createVisitorRecord({
    context,
    visitorStore,
    runtime,
    request_id,
    pathname,
    reason: "cookie_missing",
  })
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

function resolutionFromCacheEntry(cached: SessionCacheEntry): VisitorResolution {
  return {
    visitor: cached.session.visitor_uuid
      ? {
          visitor_uuid: cached.session.visitor_uuid,
          user_uuid: cached.session.user_uuid,
          source_channel: cached.session.source_channel,
        }
      : null,
    visitor_uuid: cached.session.visitor_uuid,
    action: cached.visitor_action,
    cookie_found: cached.cookie_found,
    cookie_value: cached.cookie_value,
    created_new_visitor: cached.created_new_visitor,
  }
}

async function resolve_session_context_core(
  context: AuthContext,
  visitorStore: VisitorStore,
  runtime?: SessionRuntime,
  request_id?: string | null,
): Promise<SessionCacheEntry> {
  const pathname = runtime?.pathname ?? context.requested_route ?? null

  try {
    const visitorResolution = await resolveVisitorRecord(
      context,
      visitorStore,
      runtime,
      request_id,
    )
    const visitor = visitorResolution.visitor
    const visitor_uuid = visitorResolution.visitor_uuid
    const auth_logged_out = await getRequestAuthLoggedOut(runtime)

    if (auth_logged_out) {
      await send_auth_debug(
        "session_restore_blocked_by_logout",
        {
          pathname,
          visitor_uuid,
          visitor_user_uuid: visitor?.user_uuid ?? null,
          source_channel: context.source_channel,
        },
        request_id,
      )
      await send_auth_debug(
        "session_user_restore_skipped_after_logout",
        {
          pathname,
          visitor_uuid,
          skipped_sources: ["identity", "visitor", "consumed_otp"],
          source_channel: context.source_channel,
        },
        request_id,
      )

      const session = await withLogoutVisibility({
        visitor_uuid,
        user_uuid: null,
        source_channel: context.source_channel,
      }, request_id)

      await send_auth_debug(
        "session_built",
        {
          pathname,
          visitor_uuid: session.visitor_uuid,
          user_uuid: session.user_uuid,
          source_channel: session.source_channel,
          auth_logged_out: true,
        },
        request_id,
      )

      await send_auth_debug(
        "request_summary",
        {
          ...buildRequestSummary(session, visitorResolution, runtime, context),
          auth_logged_out: true,
        },
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

    const auth_user_uuid = await visitorStore.resolveUserUuidFromAuth(context)

    await send_auth_debug(
      "session_user_resolve_started",
      {
        pathname,
        visitor_uuid,
        visitor_user_uuid: visitor?.user_uuid ?? null,
        auth_user_uuid,
        source_channel: context.source_channel,
      },
      request_id,
    )

    let user_uuid: string | null = null
    let user_uuid_source:
      | "identity"
      | "cookie"
      | "consumed_otp"
      | "none" = "none"

    if (auth_user_uuid) {
      user_uuid = auth_user_uuid
      user_uuid_source = "identity"
      await send_auth_debug(
        "session_user_resolve_from_identity",
        {
          pathname,
          visitor_uuid,
          user_uuid,
          source_channel: context.source_channel,
        },
        request_id,
      )
    } else if (visitor?.user_uuid) {
      user_uuid = visitor.user_uuid
      user_uuid_source = "cookie"
      await send_auth_debug(
        "session_user_resolve_from_cookie",
        {
          pathname,
          visitor_uuid: visitor.visitor_uuid,
          user_uuid,
          source_channel: context.source_channel,
        },
        request_id,
      )
    } else if (visitor_uuid) {
      const consumed_otp_user_uuid =
        await visitorStore.resolveUserUuidFromConsumedOtp(visitor_uuid)

      if (consumed_otp_user_uuid) {
        user_uuid = consumed_otp_user_uuid
        user_uuid_source = "consumed_otp"
        await send_auth_debug(
          "session_user_resolve_from_consumed_otp",
          {
            pathname,
            visitor_uuid,
            user_uuid,
            source_channel: context.source_channel,
          },
          request_id,
        )
      }
    }

    if (!user_uuid) {
      await send_auth_debug(
        "session_user_resolve_failed",
        {
          pathname,
          visitor_uuid,
          source_channel: context.source_channel,
          reason: "no_linked_user_uuid",
        },
        request_id,
      )
    }

    if (visitor && user_uuid && visitor.user_uuid !== user_uuid) {
      await visitorStore.linkVisitorUser(visitor.visitor_uuid, user_uuid)
      await send_auth_debug(
        "visitor_user_linked",
        {
          pathname,
          visitor_uuid: visitor.visitor_uuid,
          user_uuid,
          source: user_uuid_source,
        },
        request_id,
      )
      await send_auth_debug(
        "session_user_uuid_persisted",
        {
          pathname,
          visitor_uuid: visitor.visitor_uuid,
          user_uuid,
          source: user_uuid_source,
        },
        request_id,
      )
    }

    const session = await withLogoutVisibility({
      visitor_uuid: visitorResolution.visitor_uuid,
      user_uuid,
      source_channel: context.source_channel,
    }, request_id)

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
      "resolved_user_uuid",
      {
        pathname,
        visitor_uuid: session.visitor_uuid,
        user_uuid: session.user_uuid,
      },
      request_id,
    )

    await send_auth_debug(
      "resolved_role",
      {
        pathname,
        visitor_uuid: session.visitor_uuid,
        user_uuid: session.user_uuid,
        role: session.role,
      },
      request_id,
    )

    await send_auth_debug(
      "resolved_tier",
      {
        pathname,
        visitor_uuid: session.visitor_uuid,
        user_uuid: session.user_uuid,
        tier: session.tier,
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
  } catch (error) {
    await send_auth_debug(
      "session_failed",
      {
        pathname,
        error_message: error instanceof Error ? error.message : String(error),
      },
      request_id,
    )

    return buildFailedSessionCacheEntry(context)
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

  try {
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
              resolutionFromCacheEntry(cached),
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
  } catch (error) {
    await send_auth_debug(
      "session_failed",
      {
        pathname,
        error_message: error instanceof Error ? error.message : String(error),
      },
      request_id,
    )

    return buildAnonymousSession(context)
  }
}

export async function resolveSession(
  context: AuthContext,
  visitorStore: VisitorStore = supabaseVisitorStore,
): Promise<AppSession> {
  const request_id = await resolveRequestId()

  try {
    await send_auth_debug(
      "session_restore_started",
      {
        pathname: context.requested_route,
        source_channel: context.source_channel,
      },
      request_id,
    )

    if (context.source_channel === "pwa") {
      await send_auth_debug(
        "pwa_session_restore_started",
        {
          pathname: context.requested_route,
          source_channel: context.source_channel,
        },
        request_id,
      )
    }

    const headerSession = await getResolvedSessionFromRequestHeaders()

    if (headerSession) {
      const should_revalidate_header_session =
        !headerSession.user_uuid &&
        (Boolean(context.auth_token) ||
          (context.source_channel === "pwa" && Boolean(headerSession.visitor_uuid)))

      if (!should_revalidate_header_session) {
        if (headerSession.user_uuid) {
          await send_auth_debug(
            "session_user_resolve_from_cookie",
            {
              pathname: context.requested_route,
              visitor_uuid: headerSession.visitor_uuid,
              user_uuid: headerSession.user_uuid,
              source_channel: headerSession.source_channel,
              source: "request_header",
            },
            request_id,
          )
        }
        await send_auth_debug(
          "session_restore_success",
          {
            pathname: context.requested_route,
            visitor_uuid: headerSession.visitor_uuid,
            user_uuid: headerSession.user_uuid,
            source_channel: headerSession.source_channel,
          },
          request_id,
        )
        if (headerSession.source_channel === "pwa") {
          await send_auth_debug(
            "pwa_session_restore_success",
            {
              pathname: context.requested_route,
              visitor_uuid: headerSession.visitor_uuid,
              user_uuid: headerSession.user_uuid,
              source_channel: headerSession.source_channel,
            },
            request_id,
          )
        }
        await send_auth_debug(
          "resolve_session_exit",
          {
            pathname: context.requested_route,
            visitor_uuid: headerSession.visitor_uuid,
            source_channel: headerSession.source_channel,
            entry: "resolveSession_header_hit",
          },
          request_id,
        )
        return headerSession
      }

      await send_auth_debug(
        "session_header_revalidated",
        {
          pathname: context.requested_route,
          visitor_uuid: headerSession.visitor_uuid,
          has_auth_token: Boolean(context.auth_token),
        },
        request_id,
      )
    }

    if (visitorStore !== supabaseVisitorStore) {
      const customSession = await resolve_session_context(context, visitorStore)
      await send_auth_debug(
        "session_restore_success",
        {
          pathname: context.requested_route,
          visitor_uuid: customSession.visitor_uuid,
          user_uuid: customSession.user_uuid,
          source_channel: customSession.source_channel,
        },
        request_id,
      )
      if (customSession.source_channel === "pwa") {
        await send_auth_debug(
          "pwa_session_restore_success",
          {
            pathname: context.requested_route,
            visitor_uuid: customSession.visitor_uuid,
            user_uuid: customSession.user_uuid,
            source_channel: customSession.source_channel,
          },
          request_id,
        )
      }
      return customSession
    }

    const cachedSession = await resolveSessionCached(request_id)
    await send_auth_debug(
      "session_restore_success",
      {
        pathname: context.requested_route,
        visitor_uuid: cachedSession.visitor_uuid,
        user_uuid: cachedSession.user_uuid,
        source_channel: cachedSession.source_channel,
      },
      request_id,
    )
    if (cachedSession.source_channel === "pwa") {
      await send_auth_debug(
        "pwa_session_restore_success",
        {
          pathname: context.requested_route,
          visitor_uuid: cachedSession.visitor_uuid,
          user_uuid: cachedSession.user_uuid,
          source_channel: cachedSession.source_channel,
        },
        request_id,
      )
    }
    return cachedSession
  } catch (error) {
    await send_auth_debug(
      "session_restore_failed",
      {
        pathname: context.requested_route,
        source_channel: context.source_channel,
        error_message: error instanceof Error ? error.message : String(error),
      },
      request_id,
    )
    if (context.source_channel === "pwa") {
      await send_auth_debug(
        "pwa_session_restore_failed",
        {
          pathname: context.requested_route,
          source_channel: context.source_channel,
          error_message: error instanceof Error ? error.message : String(error),
        },
        request_id,
      )
    }
    await send_auth_debug(
      "session_failed",
      {
        pathname: context.requested_route,
        error_message: error instanceof Error ? error.message : String(error),
      },
      request_id,
    )

    return buildAnonymousSession(context)
  }
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

    return withLogoutVisibility({
      visitor_uuid,
      user_uuid: requestHeaders.get("x-amp-session-user-uuid"),
      role: normalizeSessionRole(requestHeaders.get("x-amp-session-role")),
      tier: normalizeSessionTier(requestHeaders.get("x-amp-session-tier")),
      display_name: normalizeNullableString(
        requestHeaders.get("x-amp-session-display-name"),
      ),
      image_url: normalizeNullableString(
        requestHeaders.get("x-amp-session-image-url"),
      ),
      provider: normalizeSessionProvider(
        requestHeaders.get("x-amp-session-provider"),
      ),
      email: normalizeNullableString(requestHeaders.get("x-amp-session-email")),
      source_channel,
    })
  } catch {
    return null
  }
}

export {
  authLoggedOutCookieOptions,
  visitorCookieOptions,
}
export type { AppSession, CookieOptions, SessionRuntime, VisitorStore }
export type { Session } from "@/core/auth/types"

/** @deprecated Use resolveSession instead */
export async function getAuthSession(context: AuthContext): Promise<AppSession> {
  return resolveSession(context)
}
