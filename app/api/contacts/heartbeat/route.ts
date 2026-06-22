import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { updateContactAccess } from "@/core/contacts/action"
import { normalizeContactAccessContext } from "@/core/contacts/context"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const authContext = await resolveAuthContext()
  const session = await resolveSession(authContext)

  const result = await updateContactAccess(
    normalizeContactAccessContext({
      ...body,
      heartbeat: true,
      user_uuid: session.user_uuid,
      visitor_uuid: session.visitor_uuid,
    }),
  )

  return Response.json({ ok: true, ...result })
}
