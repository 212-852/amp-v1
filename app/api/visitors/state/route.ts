import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { updateVisitorState } from "@/core/visitors/action"
import { normalizeAccessContext } from "@/core/access/context"

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const authContext = await resolveAuthContext()
    const session = await resolveSession(authContext)

    if (!session.visitor_uuid) {
      return Response.json({ access: null })
    }

    const access = await updateVisitorState(
      normalizeAccessContext({
        ...body,
        visitor_uuid: session.visitor_uuid,
      }),
    )

    return Response.json({ access })
  } catch {
    return Response.json({ access: null })
  }
}
