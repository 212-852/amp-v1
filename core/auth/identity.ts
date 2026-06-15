import type {
  AuthContext,
  IdentityRecord,
  IdentityState,
  Session,
} from "@/core/auth/types"
import { getRestConfig, restHeaders, restUrl } from "@/core/db/rest"

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

export async function resolveUserUuidByIdentityValue(value: string) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const filter = encodeURIComponent(
    `(provider_user_uuid.eq.${value},external_user_id.eq.${value})`,
  )
  const response = await fetch(
    restUrl(config, "identities", [`or=${filter}`, "select=user_uuid", "limit=1"].join("&")),
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
