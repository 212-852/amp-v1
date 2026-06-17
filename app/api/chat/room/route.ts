import {
  handleBotFixedMessage,
  handleIncomingChatMessage,
  resolveAdminChatRoom,
  resolveChatRoom,
} from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"

export async function GET(request: Request) {
  try {
    const { context, session } = await resolveChatApiSession()
    const room_uuid = new URL(request.url).searchParams.get("room_uuid")

    const state = room_uuid
      ? await resolveAdminChatRoom(room_uuid, session, {
          source_channel: context.source_channel,
          locale: context.locale,
        })
      : await resolveChatRoom(session, {
          source_channel: context.source_channel,
          locale: context.locale,
        })

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
      bot_message_key?: "quick_menu"
    }

    if (body.bot_message_key) {
      const message = await handleBotFixedMessage({
        key: body.bot_message_key,
        source_channel: context.source_channel,
        locale: context.locale,
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
      locale: context.locale,
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
