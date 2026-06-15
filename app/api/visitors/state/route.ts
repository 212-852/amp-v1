import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { updateAccess } from "@/core/access/action"
import { normalizeAccessContext } from "@/core/access/context"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const authContext = await resolveAuthContext()
  const session = await resolveSession(authContext)

  const access = session.visitor_uuid
    ? await updateAccess(
        normalizeAccessContext({
          ...body,
          visitor_uuid: session.visitor_uuid,
        }),
      )
    : null

  return Response.json({ access })
}
