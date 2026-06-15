import { normalizeContactContext } from "@/core/contacts/context"
import { upsertContact } from "@/core/contacts/action"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const authContext = await resolveAuthContext()
  const session = await resolveSession(authContext)
  const contact = await upsertContact(
    normalizeContactContext({
      ...body,
      user_uuid: session.user_uuid,
      visitor_uuid: session.visitor_uuid,
    }),
  )

  return Response.json({ contact })
}
