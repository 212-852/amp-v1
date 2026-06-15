import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { updateContactState } from "@/core/contacts/action"
import { normalizeContactContext } from "@/core/contacts/context"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const authContext = await resolveAuthContext()
  const session = await resolveSession(authContext)

  await updateContactState(
    normalizeContactContext({
      ...body,
      user_uuid: session.user_uuid,
      visitor_uuid: session.visitor_uuid,
    }),
  )

  return Response.json({ ok: true })
}
