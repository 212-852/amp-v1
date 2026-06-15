import type {
  AuthContext,
  IdentityRecord,
  IdentityState,
  Session,
} from "@/core/auth/types"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import type { ContactInput } from "@/core/contacts/context"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendAuthDebug } from "@/core/debug"

export type IdentityLinkState = {
  user_uuid: string | null
  identity_state: IdentityState
  linked: boolean
}

export async function resolveIdentity(
  _context: AuthContext,
  session: Session,
): Promise<IdentityRecord> {
  const identity_state: IdentityState = session.user_uuid ? "linked" : "anonymous"

  return {
    user_uuid: session.user_uuid,
    identity_state,
    linked_providers: [],
  }
}

export async function getIdentityLinkState(
  _context: AuthContext,
  session: Session,
): Promise<IdentityLinkState> {
  const identity_state: IdentityState = session.user_uuid ? "linked" : "anonymous"

  return {
    user_uuid: session.user_uuid,
    identity_state,
    linked: identity_state === "linked",
  }
}

type UserUuidRow = {
  user_uuid?: string | null
}

export type IdentityProvider = "line" | "google" | "email"

export type IdentityLinkInput = {
  provider: IdentityProvider
  provider_user_id?: string | null
  email?: string | null
  display_name?: string | null
  image_url?: string | null
  locale?: string | null
}

export type SupabaseAuthUser = {
  id?: string
  email?: string | null
  user_metadata?: {
    sub?: string | null
    email?: string | null
    full_name?: string | null
    name?: string | null
  } | null
}

type IdentityRow = {
  identity_uuid?: string | null
  user_uuid?: string | null
  provider?: IdentityProvider | null
  provider_user_id?: string | null
  email?: string | null
}

type UserRow = {
  user_uuid?: string | null
  role?: string | null
  tier?: string | null
  display_name?: string | null
  image_url?: string | null
  locale?: string | null
}

export type IdentityLinkRecord = {
  identity_uuid: string | null
  user_uuid: string
}

export type AuthUserProfile = {
  user_uuid: string | null
  role: string
  tier: string
  display_name: string | null
  image_url: string | null
  provider: IdentityProvider | null
  provider_user_id: string | null
  email: string | null
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export function normalizeIdentityLinkInput(
  input: Record<string, unknown>,
): IdentityLinkInput {
  const provider = input.provider

  if (provider !== "line" && provider !== "google" && provider !== "email") {
    throw new Error("Identity provider must be line, google, or email")
  }

  const provider_user_id = normalizeString(input.provider_user_id)
  const email = normalizeString(input.email)

  if (provider === "email" && !email) {
    throw new Error("Email identity requires email")
  }

  if ((provider === "line" || provider === "google") && !provider_user_id) {
    throw new Error("Provider identity requires provider_user_id")
  }

  return {
    provider,
    provider_user_id: provider === "email" ? email : provider_user_id,
    email,
    display_name: normalizeString(input.display_name),
    image_url: normalizeString(input.image_url),
    locale: normalizeString(input.locale),
  }
}

function identityValue(input: IdentityLinkInput) {
  return input.provider_user_id ?? (input.provider === "email" ? input.email : null)
}

export function contactInputFromIdentity(
  input: IdentityLinkInput,
): ContactInput | null {
  const value = identityValue(input)

  if (!value) {
    return null
  }

  if (input.provider === "line") {
    return {
      type: "line",
      value,
    }
  }

  if (input.provider === "email" || (input.provider === "google" && input.email)) {
    return {
      type: "email",
      value: input.email ?? value,
    }
  }

  return null
}

export function normalizeGoogleIdentityInput(
  user: SupabaseAuthUser,
  locale?: string | null,
): IdentityLinkInput {
  const provider_user_id = normalizeString(user.user_metadata?.sub) ?? normalizeString(user.id)

  if (!provider_user_id) {
    throw new Error("Google identity requires provider_user_id")
  }

  return normalizeIdentityLinkInput({
    provider: "google",
    provider_user_id,
    email: user.email ?? user.user_metadata?.email ?? null,
    display_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    locale,
  })
}

export async function sendIdentityDebug(
  event:
    | "auth_callback_received"
    | "contact_upsert_failed"
    | "google_oauth_callback_received"
    | "google_oauth_start"
    | "google_oauth_state_failed"
    | "google_code_exchange_failed"
    | "google_code_exchange_success"
    | "google_token_exchange_failed"
    | "google_token_exchange_success"
    | "identity_upsert_payload"
    | "identity_link_failed"
    | "identity_link_started"
    | "identity_link_success"
    | "identity_unlinked"
    | "oauth_callback_code_found"
    | "oauth_callback_code_missing"
    | "oauth_callback_enter"
    | "oauth_exchange_failed"
    | "oauth_exchange_success"
    | "oauth_start"
    | "session_after_identity_link",
  payload: Record<string, unknown>,
  request_id?: string | null,
) {
  await sendAuthDebug(event, payload, request_id)
}

export async function sendCurrentIdentityLinkStarted(provider: IdentityProvider) {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)

  await sendIdentityDebug("identity_link_started", {
    provider,
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    source_channel: context.source_channel,
  })
  await sendIdentityDebug("oauth_start", {
    provider,
    visitor_uuid: session.visitor_uuid,
    user_uuid: session.user_uuid,
    source_channel: context.source_channel,
  })
}

export async function sendIdentityLinkStartedFromInput(
  input: Record<string, unknown>,
) {
  const provider = input.provider

  if (provider !== "google" && provider !== "line" && provider !== "email") {
    throw new Error("Identity provider must be google, line, or email")
  }

  await sendCurrentIdentityLinkStarted(provider)
}

function identityLookupQuery(input: IdentityLinkInput) {
  const value = identityValue(input)

  if (!value) {
    throw new Error("Identity value is required")
  }

  const filters =
    input.provider === "email" && input.email
      ? [
          `provider_user_id.eq.${encodeURIComponent(value)}`,
          `email.eq.${encodeURIComponent(input.email)}`,
        ]
      : [`provider_user_id.eq.${encodeURIComponent(value)}`]

  return [
    `provider=eq.${encodeURIComponent(input.provider)}`,
    `or=(${filters.join(",")})`,
    "select=user_uuid",
    "limit=1",
  ].join("&")
}

async function findIdentityUserUuid(input: IdentityLinkInput) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(restUrl(config, "identities", identityLookupQuery(input)), {
    headers: restHeaders(config),
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as IdentityRow[]

  return rows[0]?.user_uuid ?? null
}

async function findUserUuidByIdentityEmail(email: string | null) {
  const config = getRestConfig()

  if (!config || !email) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "identities",
      [
        `email=eq.${encodeURIComponent(email)}`,
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

async function createUser(input: IdentityLinkInput) {
  const config = getRestConfig()

  if (!config) {
    return crypto.randomUUID()
  }

  const response = await fetch(restUrl(config, "users", "select=user_uuid"), {
    method: "POST",
    headers: {
      ...restHeaders(config),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      role: "user",
      tier: "member",
      locale: input.locale ?? "en",
      display_name: input.display_name ?? input.email ?? null,
      image_url: input.image_url ?? null,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to create user: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as UserRow[]
  const user_uuid = rows[0]?.user_uuid

  if (!user_uuid) {
    throw new Error("User creation did not return user_uuid")
  }

  return user_uuid
}

export async function resolveOrCreateIdentityUser(input: IdentityLinkInput) {
  return (
    (await findIdentityUserUuid(input)) ??
    (await findUserUuidByIdentityEmail(input.email ?? null)) ??
    (await createUser(input))
  )
}

export async function upsertIdentityLink(
  input: IdentityLinkInput,
  user_uuid: string,
): Promise<IdentityLinkRecord | null> {
  const config = getRestConfig()
  const value = identityValue(input)

  if (!config || !value) {
    return null
  }

  const existingUserUuid = await findIdentityUserUuid(input)

  if (existingUserUuid && existingUserUuid !== user_uuid) {
    throw new Error("Identity is already linked to another user")
  }

  await sendIdentityDebug("identity_upsert_payload", {
    provider: input.provider,
    user_uuid,
    provider_user_id: value,
    email: input.email ?? null,
  })

  const response = await fetch(
    restUrl(
      config,
      "identities",
      "on_conflict=provider,provider_user_id&select=identity_uuid,user_uuid",
    ),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        provider: input.provider,
        provider_user_id: value,
        email: input.email ?? null,
        user_uuid,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to upsert identity: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as IdentityRow[]
  const row = rows[0]

  if (!row?.user_uuid) {
    return null
  }

  return {
    identity_uuid: row.identity_uuid ?? null,
    user_uuid: row.user_uuid,
  }
}

export async function sendIdentityUnlinkedDebug(input: {
  provider: IdentityProvider
  visitor_uuid: string | null
  user_uuid: string | null
  identity_uuid: string | null
}) {
  await sendIdentityDebug("identity_unlinked", input)
}

export async function resolveUserUuidByIdentityValue(value: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "identities",
      [
        `provider_user_id=eq.${encodeURIComponent(value)}`,
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

  const rows = (await response.json()) as UserUuidRow[]

  return rows[0]?.user_uuid ?? null
}

export async function resolveAuthUserProfile(user_uuid: string | null): Promise<AuthUserProfile> {
  const empty: AuthUserProfile = {
    user_uuid,
    role: user_uuid ? "user" : "guest",
    tier: user_uuid ? "member" : "guest",
    display_name: null,
    image_url: null,
    provider: null,
    provider_user_id: null,
    email: null,
  }
  const config = getRestConfig()

  if (!config || !user_uuid) {
    return empty
  }

  const [userResponse, identityResponse] = await Promise.all([
    fetch(
      restUrl(
        config,
        "users",
        [
          `user_uuid=eq.${encodeURIComponent(user_uuid)}`,
          "select=user_uuid,role,tier,display_name,image_url,locale",
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

  const users = userResponse.ok ? ((await userResponse.json()) as UserRow[]) : []
  const identities = identityResponse.ok ? ((await identityResponse.json()) as IdentityRow[]) : []
  const user = users[0]
  const identity = identities[0]

  return {
    user_uuid,
    role: user?.role ?? empty.role,
    tier: user?.tier ?? empty.tier,
    display_name: user?.display_name ?? null,
    image_url: user?.image_url ?? null,
    provider: identity?.provider ?? null,
    provider_user_id: identity?.provider_user_id ?? null,
    email: identity?.email ?? null,
  }
}
