import { resolveAuthContext } from "@/core/auth/context"
import { resolveUserUuidByIdentityValue } from "@/core/auth/identity"
import type { AppSession } from "@/core/auth/session"
import { getRestConfig, restHeaders, restUrl } from "@/core/db/rest"
import { handleIncomingChatMessage } from "@/core/chat/action"
import { findVisitorUuidByUser } from "@/core/chat/archive"
import { upsertLineContactsFromEvents } from "@/core/line/action"

async function resolveLineChatSession(user_uuid: string): Promise<{
  session: AppSession
  locale: string | null
}> {
  const visitor_uuid = await findVisitorUuidByUser(user_uuid)
  const config = getRestConfig()

  if (!config) {
    return {
      session: {
        visitor_uuid,
        user_uuid,
        role: "user",
        tier: "member",
        display_name: null,
        image_url: null,
        provider: "line",
        email: null,
        source_channel: "line",
        can_logout: false,
        can_start_line_oauth: false,
      },
      locale: null,
    }
  }

  const response = await fetch(
    restUrl(
      config,
      "users",
      `user_uuid=eq.${encodeURIComponent(user_uuid)}&select=role,tier,display_name,image_url,locale`,
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  const rows = response.ok
    ? ((await response.json()) as Array<{
        role?: string
        tier?: string
        display_name?: string | null
        image_url?: string | null
        locale?: string | null
      }>)
    : []

  const user = rows[0]

  return {
    session: {
      visitor_uuid,
      user_uuid,
      role:
        user?.role === "admin" || user?.role === "driver" || user?.role === "user"
          ? user.role
          : "user",
      tier: user?.tier ?? "member",
      display_name: user?.display_name ?? null,
      image_url: user?.image_url ?? null,
      provider: "line",
      email: null,
      source_channel: "line",
      can_logout: false,
      can_start_line_oauth: false,
    },
    locale: user?.locale ?? null,
  }
}

type LineTextMessageEvent = {
  type?: string
  message?: {
    type?: string
    text?: string
  }
  source?: {
    userId?: string
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    events?: LineTextMessageEvent[]
  }
  const events = Array.isArray(body.events) ? body.events : []

  await upsertLineContactsFromEvents(events)

  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") {
      continue
    }

    const line_user_id = event.source?.userId
    const text = event.message.text?.trim()

    if (!line_user_id || !text) {
      continue
    }

    const user_uuid = await resolveUserUuidByIdentityValue(line_user_id)

    if (!user_uuid) {
      continue
    }

    const context = await resolveAuthContext()
    const { session, locale } = await resolveLineChatSession(user_uuid)

    await handleIncomingChatMessage({
      body: text,
      source_channel: "line",
      locale: locale ?? context.locale,
      session,
    }).catch(() => null)
  }

  return Response.json({ ok: true })
}
