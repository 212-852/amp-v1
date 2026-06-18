import {
  handleIncomingChatMessage,
  handleQuickMenuRequested,
  handleChatRoomBootstrap,
  loadChatRoom,
  resolveAdminChatRoom,
} from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"
import { resolveOutputLocaleDecision } from "@/core/chat/context"
import { sendAuthDebug } from "@/core/debug"

function logChatRoomGetNoRoom(data: Record<string, unknown>) {
  console.info("[chat_bootstrap] chat_room_get_no_room", data)
}

async function readChatRoomDebugContext(input: {
  visitor_uuid: string | null
  user_uuid: string | null
  pathname?: string | null
}) {
  let request_id: string | null = null
  let pathname = input.pathname ?? null

  try {
    const { headers } = await import("next/headers")
    const request_headers = await headers()

    request_id = request_headers.get("x-amp-request-id")
    pathname =
      pathname ??
      request_headers.get("x-amp-pathname") ??
      request_headers.get("x-amp-route")
  } catch {
    // headers unavailable outside request scope
  }

  return {
    visitor_uuid: input.visitor_uuid,
    user_uuid: input.user_uuid,
    room_uuid: null,
    request_id,
    pathname,
  }
}

export async function GET(request: Request) {
  try {
    const { context, session } = await resolveChatApiSession()
    const url = new URL(request.url)
    const room_uuid = url.searchParams.get("room_uuid")
    const request_locale = url.searchParams.get("locale") ?? context.locale
    const locale_decision = resolveOutputLocaleDecision({
      preferred: request_locale,
    })

    await sendAuthDebug("app_locale_resolved", {
      final_locale: locale_decision.final_locale,
      source: url.searchParams.get("locale")
        ? "request_query"
        : locale_decision.source,
      user_locale: null,
      session_locale: context.locale ?? null,
      cookie_locale: null,
      room_locale: null,
      browser_locale: null,
    })

    const state = room_uuid
      ? await resolveAdminChatRoom(room_uuid, session, {
          source_channel: context.source_channel,
          locale: request_locale,
        })
      : await loadChatRoom(session, {
          source_channel: context.source_channel,
          locale: request_locale,
        })

    if (!state) {
      logChatRoomGetNoRoom(
        await readChatRoomDebugContext({
          visitor_uuid: session.visitor_uuid,
          user_uuid: session.user_uuid,
        }),
      )

      return Response.json({
        room: null,
        participant: null,
        messages: [],
        presence: [],
        concierge_available: true,
      })
    }

    return Response.json({
      room: state.room,
      participant: state.participant,
      messages: state.messages,
      presence: state.presence,
      concierge_available: state.concierge_available,
    })
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to load chat room",
      },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { context, session } = await resolveChatApiSession()
    const body = (await request.json().catch(() => ({}))) as {
      message?: string
      trigger?: "quick_menu_requested" | "chat_opened"
      locale?: string
    }
    const request_locale =
      typeof body.locale === "string" && body.locale.trim()
        ? body.locale.trim()
        : context.locale
    const locale_decision = resolveOutputLocaleDecision({
      preferred: request_locale,
    })

    await sendAuthDebug("app_locale_resolved", {
      final_locale: locale_decision.final_locale,
      source: body.locale ? "request_body" : locale_decision.source,
      user_locale: null,
      session_locale: context.locale ?? null,
      cookie_locale: null,
      room_locale: null,
      browser_locale: null,
    })

    if (body.trigger === "chat_opened") {
      const state = await handleChatRoomBootstrap({
        source_channel: context.source_channel,
        locale: request_locale,
        session,
      })

      return Response.json({
        room: state.room,
        participant: state.participant,
        messages: state.messages,
        presence: state.presence,
        concierge_available: state.concierge_available,
      })
    }

    if (body.trigger === "quick_menu_requested") {
      const message = await handleQuickMenuRequested({
        source_channel: context.source_channel,
        locale: request_locale,
        session,
      })

      return Response.json({ message })
    }

    if (!body.message) {
      return Response.json({ error: "message is required" }, { status: 400 })
    }

    const message = await handleIncomingChatMessage({
      body: body.message,
      source_channel: context.source_channel,
      locale: request_locale,
      session,
    })

    return Response.json({ message })
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to send message",
      },
      { status: 400 },
    )
  }
}
