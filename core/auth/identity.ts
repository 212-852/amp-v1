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
    | "bridge_completed"
    | "bridge_callback_complete_page_shown"
    | "callback_return_to_app_screen_rendered"
    | "bridge_authorize_url_created"
    | "bridge_insert_start"
    | "bridge_insert_success"
    | "bridge_poll_pending"
    | "bridge_poll_success"
    | "bridge_polling_started"
    | "bridge_start"
    | "bridge_start_api_enter"
    | "bridge_start_api_failed"
    | "bridge_start_api_response"
    | "bridge_start_authorize_url_created"
    | "bridge_start_context_resolved"
    | "bridge_start_insert_attempt"
    | "bridge_start_insert_success"
    | "bridge_start_request"
    | "bridge_start_response"
    | "bridge_state_created"
    | "bridge_state_valid"
    | "bridge_status_pending"
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
    | "identity_lookup_result"
    | "identity_lookup_start"
    | "identity_email_lookup_result"
    | "identity_email_lookup_start"
    | "identity_resolved"
    | "identity_unlinked"
    | "identity_upsert_start"
    | "identity_upsert_success"
    | "identity_user_resolve_result"
    | "line_identity_link_success"
    | "line_callback_bridge_detected"
    | "line_login_button_clicked"
    | "line_oauth_authorize_url"
    | "line_oauth_callback_received"
    | "line_oauth_redirect_complete"
    | "line_oauth_redirect_start"
    | "line_oauth_skipped_for_liff"
    | "line_oauth_started"
    | "line_callback_redirect"
    | "line_callback_user_resolved"
    | "oauth_callback_code_found"
    | "oauth_callback_code_missing"
    | "oauth_callback_enter"
    | "oauth_state_compare_failed"
    | "oauth_state_compare_success"
    | "oauth_state_cookie_found"
    | "oauth_state_cookie_missing"
    | "oauth_state_saved_cookie"
    | "oauth_exchange_failed"
    | "oauth_exchange_success"
    | "oauth_start"
    | "otp_environment_loaded"
    | "otp_send_request"
    | "otp_send_success"
    | "otp_verify_request"
    | "otp_verify_failed"
    | "otp_verify_success"
    | "pwa_reload_after_bridge"
    | "pwa_bridge_start_request"
    | "pwa_launch_entered"
    | "pwa_bridge_fetch_failed"
    | "pwa_bridge_fetch_response"
    | "pwa_bridge_fetch_started"
    | "pwa_bridge_fetch_timeout"
    | "pwa_bridge_start_failed"
    | "pwa_bridge_start_success"
    | "pwa_line_popup_blocked"
    | "pwa_login_focus_check"
    | "pwa_login_pageshow_check"
    | "pwa_login_pending_set"
    | "pwa_popup_connecting_page_failed"
    | "pwa_popup_connecting_page_written"
    | "pwa_line_popup_opened"
    | "pwa_line_popup_redirected"
    | "pwa_login_polling_authenticated"
    | "pwa_login_polling_started"
    | "pwa_login_polling_tick"
    | "pwa_login_polling_timeout"
    | "pwa_login_polling_user_found"
    | "pwa_login_reload_triggered"
    | "pwa_login_success_ui_shown"
    | "pwa_popup_close_attempted"
    | "pwa_popup_close_failed"
    | "pwa_session_restored"
    | "pwa_session_refresh_failed"
    | "pwa_session_refresh_success"
    | "pwa_waiting_ui_shown"
    | "session_update"
    | "session_updated"
    | "session_after_identity_link"
    | "user_create_start"
    | "user_create_success"
    | "user_profile_sync_failed"
    | "user_profile_sync_start"
    | "user_profile_sync_success"
    | "visitor_update_start"
    | "visitor_update_success",
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

function identityProviderUserIdQuery(input: IdentityLinkInput) {
  const value = identityValue(input)

  if (!value) {
    throw new Error("Identity value is required")
  }

  return [
    `provider=eq.${encodeURIComponent(input.provider)}`,
    `provider_user_id=eq.${encodeURIComponent(value)}`,
    "select=user_uuid",
    "limit=1",
  ].join("&")
}

async function findIdentityUserUuidByProviderUserId(input: IdentityLinkInput) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  await sendIdentityDebug("identity_lookup_start", {
    provider: input.provider,
    provider_user_id: identityValue(input),
    email: input.email ?? null,
  })

  const response = await fetch(
    restUrl(config, "identities", identityProviderUserIdQuery(input)),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to lookup identity: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as IdentityRow[]
  const user_uuid = rows[0]?.user_uuid ?? null

  await sendIdentityDebug("identity_lookup_result", {
    provider: input.provider,
    provider_user_id: identityValue(input),
    email: input.email ?? null,
    found: !!user_uuid,
    user_uuid,
  })

  return user_uuid
}

async function findUserUuidByIdentityEmail(email: string | null) {
  const config = getRestConfig()

  if (!config || !email) {
    return null
  }

  await sendIdentityDebug("identity_email_lookup_start", {
    provider: "email",
    email,
  })

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
    await sendIdentityDebug("identity_email_lookup_result", {
      provider: "email",
      email,
      found: false,
      error: "identity_email_lookup_failed",
    })
    return null
  }

  const rows = (await response.json()) as IdentityRow[]
  const user_uuid = rows[0]?.user_uuid ?? null

  await sendIdentityDebug("identity_email_lookup_result", {
    provider: "email",
    email,
    found: !!user_uuid,
    user_uuid,
  })

  return user_uuid
}

async function createUser(input: IdentityLinkInput) {
  const config = getRestConfig()

  if (!config) {
    return crypto.randomUUID()
  }

  await sendIdentityDebug("user_create_start", {
    provider: input.provider,
    provider_user_id: identityValue(input),
    email: input.email ?? null,
  })

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

  await sendIdentityDebug("user_create_success", {
    provider: input.provider,
    provider_user_id: identityValue(input),
    email: input.email ?? null,
    user_uuid,
  })

  return user_uuid
}

export async function resolveOrCreateIdentityUser(
  input: IdentityLinkInput,
  current_user_uuid?: string | null,
) {
  const identityUserUuid = await findIdentityUserUuidByProviderUserId(input)

  if (identityUserUuid) {
    await sendIdentityDebug("identity_user_resolve_result", {
      provider: input.provider,
      provider_user_id: identityValue(input),
      email: input.email ?? null,
      user_uuid: identityUserUuid,
      source: "identity",
    })
    return identityUserUuid
  }

  if (current_user_uuid) {
    await sendIdentityDebug("identity_user_resolve_result", {
      provider: input.provider,
      provider_user_id: identityValue(input),
      email: input.email ?? null,
      user_uuid: current_user_uuid,
      source: "current_user",
    })
    return current_user_uuid
  }

  const emailUserUuid = await findUserUuidByIdentityEmail(input.email ?? null)

  if (emailUserUuid) {
    await sendIdentityDebug("identity_user_resolve_result", {
      provider: input.provider,
      provider_user_id: identityValue(input),
      email: input.email ?? null,
      user_uuid: emailUserUuid,
      source: "email_identity",
    })
    return emailUserUuid
  }

  const createdUserUuid = await createUser(input)

  await sendIdentityDebug("identity_user_resolve_result", {
    provider: input.provider,
    provider_user_id: identityValue(input),
    email: input.email ?? null,
    user_uuid: createdUserUuid,
    source: "created_user",
  })

  return createdUserUuid
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

  const existingUserUuid = await findIdentityUserUuidByProviderUserId(input)

  if (existingUserUuid && existingUserUuid !== user_uuid) {
    throw new Error("Identity is already linked to another user")
  }

  await sendIdentityDebug("identity_upsert_payload", {
    provider: input.provider,
    user_uuid,
    provider_user_id: value,
    email: input.email ?? null,
  })
  await sendIdentityDebug("identity_upsert_start", {
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

  await sendIdentityDebug("identity_upsert_success", {
    provider: input.provider,
    user_uuid: row.user_uuid,
    identity_uuid: row.identity_uuid ?? null,
    provider_user_id: value,
    email: input.email ?? null,
  })

  return {
    identity_uuid: row.identity_uuid ?? null,
    user_uuid: row.user_uuid,
  }
}

export async function syncUserProfileFromIdentityLink(
  user_uuid: string,
  input: IdentityLinkInput,
) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const patch: Record<string, string> = {}

  if (input.display_name) {
    patch.display_name = input.display_name
  }

  if (input.image_url) {
    patch.image_url = input.image_url
  }

  if (Object.keys(patch).length === 0) {
    return
  }

  await sendIdentityDebug("user_profile_sync_start", {
    provider: input.provider,
    user_uuid,
    has_display_name: Boolean(input.display_name),
    has_image_url: Boolean(input.image_url),
  })

  const response = await fetch(
    restUrl(config, "users", `user_uuid=eq.${encodeURIComponent(user_uuid)}`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify(patch),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    await sendIdentityDebug("user_profile_sync_failed", {
      provider: input.provider,
      user_uuid,
      error_code: error.code ?? null,
      error_message: error.message ?? null,
    })
    return
  }

  await sendIdentityDebug("user_profile_sync_success", {
    provider: input.provider,
    user_uuid,
  })
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

export async function resolveIdentityByProviderUserId(input: {
  provider: IdentityProvider
  provider_user_id: string
}) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "identities",
      [
        `provider=eq.${encodeURIComponent(input.provider)}`,
        `provider_user_id=eq.${encodeURIComponent(input.provider_user_id)}`,
        "select=identity_uuid,user_uuid",
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
  return rows[0] ?? null
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
