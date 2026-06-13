import type { EntranceContext } from "@/core/entrance/context"

export type SessionRole = "guest" | "member" | "driver" | "admin"

export type AuthSession = {
  role: SessionRole
  userId: string | null
}

export async function getAuthSession(
  context: EntranceContext,
): Promise<AuthSession> {
  void context

  return {
    role: "guest",
    userId: null,
  }
}
