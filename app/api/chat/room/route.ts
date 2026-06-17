import {
  getConciergeAvailabilityState,
  handleChatModeSwitch,
  handleChatTyping,
  handleIncomingChatMessage,
  resolveChatRoom,
  toggleConciergeAvailability,
} from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"

export async function GET() {
  try {
    const { context, session } = await resolveChatApiSession()
    const state = await resolveChatRoom(session, {
      source_channel: context.source_channel,
      locale: context.locale,
    })

    return Response.json({
      room: state.room,
      participant: state.participant,
      messages: state.messages,
      typing: state.typing,
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
