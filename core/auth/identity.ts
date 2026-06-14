import type {
  AuthContext,
  IdentityRecord,
  IdentityState,
  Session,
} from "@/core/auth/types"

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
