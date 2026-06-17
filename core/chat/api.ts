import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"

export async function resolveChatApiSession() {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)

  return { context, session }
}
