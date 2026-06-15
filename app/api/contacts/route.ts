import { normalizeContactContext } from "@/core/contacts/context"
import { upsertContact } from "@/core/contacts/action"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"

function isAccessStatePayload(body: Record<string, unknown>) {
  return (
    "state" in body ||
    "heartbeat" in body ||
    "source_channel" in body ||
    "last_seen_at" in body
  )
}

function isFakePushDestination(body: Record<string, unknown>) {
  const value = body.value

  return typeof value === "string" && value.startsWith("push:visitor:")
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >

    if (isAccessStatePayload(body)) {
      return Response.json(
        {
          error: "Access state must use /api/visitors/state",
          use: "/api/visitors/state",
        },
        { status: 400 },
      )
    }

    if (isFakePushDestination(body)) {
      return Response.json(
        {
          error: "Contacts require a real delivery destination",
        },
        { status: 400 },
      )
    }

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
  } catch (error) {
    return Response.json(
      {
        contact: null,
        error:
          error instanceof Error
            ? error.message
            : "Contact requires a real delivery destination",
      },
      { status: 400 },
    )
  }
}
