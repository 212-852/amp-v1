import { cookies } from "next/headers"

import { normalizeContactContext, type ContactInput } from "@/core/contacts/context"
import { linkVisitorContactsToUser, upsertContact } from "@/core/contacts/action"
import { resolveAuthContext } from "@/core/auth/context"
import {
  contactInputFromIdentity,
  normalizeIdentityLinkInput,
  resolveOrCreateIdentityUser,
  sendIdentityDebug,
  syncUserProfileFromIdentityLink,
  upsertIdentityLink,
  type IdentityLinkInput,
  type IdentityLinkState,
} from "@/core/auth/identity"
import {
  resolveSession,
  VISITOR_COOKIE_NAME,
  type AppSession,
} from "@/core/auth/session"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendAuthDebug } from "@/core/debug"

export function isLinkedIdentity(identity: IdentityLinkState): boolean {
  return identity.linked
}

export type AuthLinkInput = IdentityLinkInput & {
  contact?: ContactInput | null
}

export type AuthLinkResult = {
  visitor_uuid: string
  user_uuid: string
  identity_uuid: string | null
  email: string | null
  display_name: string | null
  source_channel: string
  session: AppSession
}

type VisitorLinkRow = {
  visitor_uuid?: string | null
  user_uuid?: string | null
}

async function getVisitorUuidFromCookie() {
  const cookieStore = await cookies()

  return cookieStore.get(VISITOR_COOKIE_NAME)?.value ?? null
}

async function linkVisitorToUser(visitor_uuid: string, user_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const response = await fetch(
    restUrl(config, "visitors", `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_uuid,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    await sendIdentityDebug("visitor_update_failed", {
      visitor_uuid,
      user_uuid,
      error_code: error.code ?? null,
      error_message: error.message ?? null,
    })
    throw new Error(
      `Failed to link visitor to user: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as VisitorLinkRow[]

  if (!rows[0]?.visitor_uuid) {
    await sendAuthDebug("visitor_missing", {
      visitor_uuid,
      user_uuid,
    })
    throw new Error("Visitor was not found while linking user")
  }
}

async function linkParticipantsToUser(visitor_uuid: string, user_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const response = await fetch(
    restUrl(
      config,
      "participants",
      `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}&user_uuid=is.null`,
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

  if (!response.ok) {
    const error = await readRestError(response)
    await sendAuthDebug("participant_transfer_failed", {
      visitor_uuid,
      user_uuid,
      error_code: error.code ?? null,
      error_message: error.message ?? null,
      error_details: error.details ?? null,
    })
  }
}

async function upsertRealContact(
  input: AuthLinkInput,
  visitor_uuid: string,
  user_uuid: string,
  source_channel: AuthLinkResult["source_channel"],
) {
  const contact = input.contact ?? contactInputFromIdentity(input)

  if (!contact) {
    return
  }

  try {
    await upsertContact(
      normalizeContactContext({
        ...contact,
        user_uuid,
        visitor_uuid,
        channel: source_channel,
        receive: true,
      }),
    )
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error)

    await sendIdentityDebug("contact_upsert_failed", {
      provider: input.provider,
      user_uuid,
      visitor_uuid,
      type: contact.type,
      value: contact.value,
      channel: source_channel,
      reason: "contact_upsert_failed",
      error_message,
    })
  }
}

async function linkExistingVisitorContacts(
  visitor_uuid: string,
  user_uuid: string,
  input: AuthLinkInput,
) {
  try {
    await linkVisitorContactsToUser(visitor_uuid, user_uuid)
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error)

    await sendIdentityDebug("contact_upsert_failed", {
      provider: input.provider,
      user_uuid,
      visitor_uuid,
      reason: "contact_link_failed",
      error_message,
    })
  }
}

export async function linkCurrentVisitorToIdentity(
  rawInput: Record<string, unknown>,
): Promise<AuthLinkResult> {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const visitor_uuid = (await getVisitorUuidFromCookie()) ?? session.visitor_uuid

  if (!visitor_uuid) {
    await sendAuthDebug("visitor_missing", {
      provider: rawInput.provider ?? null,
    })
    throw new Error("Cannot link identity without visitor_uuid")
  }

  return linkVisitorToIdentity(rawInput, {
    visitor_uuid,
    current_user_uuid: session.user_uuid,
    source_channel: context.source_channel,
    locale: context.locale,
    session,
  })
}

export async function linkVisitorToIdentity(
  rawInput: Record<string, unknown>,
  options: {
    visitor_uuid: string
    current_user_uuid?: string | null
    source_channel: string
    locale?: string | null
    session?: AppSession
  },
): Promise<AuthLinkResult> {
  const visitor_uuid = options.visitor_uuid

  const identityInput = normalizeIdentityLinkInput({
    ...rawInput,
    locale: rawInput.locale ?? options.locale,
  })
  const input: AuthLinkInput = {
    ...identityInput,
    contact:
      rawInput.contact && typeof rawInput.contact === "object"
        ? (rawInput.contact as ContactInput)
        : null,
  }
  const { user_uuid, created_new_user } = await resolveOrCreateIdentityUser(
    input,
    options.current_user_uuid,
  )
  await syncUserProfileFromIdentityLink(user_uuid, input)
  let identity: Awaited<ReturnType<typeof upsertIdentityLink>> = null

  try {
    identity = await upsertIdentityLink(input, user_uuid, {
      notify_success: created_new_user,
    })
    await linkVisitorToUser(visitor_uuid, user_uuid)
    await sendAuthDebug("session_user_uuid_persisted", {
      provider: input.provider,
      visitor_uuid,
      user_uuid,
      source_channel: options.source_channel,
      source: "identity_link",
    })
    await linkExistingVisitorContacts(visitor_uuid, user_uuid, input)
    await upsertRealContact(input, visitor_uuid, user_uuid, options.source_channel)
    await linkParticipantsToUser(visitor_uuid, user_uuid)
  } catch (error) {
    const error_message = error instanceof Error ? error.message : String(error)

    if (error_message.includes("link visitor")) {
      await sendAuthDebug("user_link_failed", {
        visitor_uuid,
        user_uuid,
        error_message,
      })
    }

    if (error_message.includes("already linked")) {
      await sendIdentityDebug("identity_link_failed", {
        provider: input.provider,
        visitor_uuid,
        user_uuid,
        reason: "identity_conflict",
        error: error_message,
        source_channel: options.source_channel,
      })
    } else {
      await sendIdentityDebug("session_update_failed", {
        provider: input.provider,
        visitor_uuid,
        user_uuid,
        error_message,
        source_channel: options.source_channel,
      })
    }
    throw error
  }

  const session = options.session ?? {
    visitor_uuid,
    user_uuid: null,
    role: "guest" as const,
    tier: "guest" as const,
    display_name: null,
    image_url: null,
    provider: null,
    email: null,
    source_channel: options.source_channel as AppSession["source_channel"],
    can_logout: false,
    can_start_line_oauth: false,
  }

  return {
    visitor_uuid,
    user_uuid,
    identity_uuid: identity?.identity_uuid ?? null,
    email: input.email ?? null,
    display_name: input.display_name ?? null,
    source_channel: options.source_channel,
    session: {
      ...session,
      visitor_uuid,
      user_uuid,
      display_name: input.display_name ?? session.display_name,
      image_url: input.image_url ?? session.image_url,
      provider: input.provider,
      email: input.email ?? session.email,
    },
  }
}
