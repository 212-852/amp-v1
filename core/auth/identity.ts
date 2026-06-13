import type { AuthSession } from "@/core/auth/session"
import type { EntranceContext } from "@/core/entrance/context"

export type IdentityLinkState = {
  userId: string | null
  linked: boolean
}

export async function getIdentityLinkState(
  _context: EntranceContext,
  session: AuthSession,
): Promise<IdentityLinkState> {
  return {
    userId: session.userId,
    linked: false,
  }
}
