import { handleChatTyping } from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"

export async function POST(request: Request) {
  try {
    const { context, session } = await resolveChatApiSession()
    const body = (await request.json().catch(() => ({}))) as {
      is_typing?: boolean
      room_uuid?: string
    }

    const result = await handleChatTyping({
      is_typing: Boolean(body.is_typing),
      source_channel: context.source_channel,
      locale: context.locale,
      session,
      room_uuid:
        typeof body.room_uuid === "string" && body.room_uuid.trim()
          ? body.room_uuid.trim()
          : null,
    })

    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update typing state",
      },
      { status: 400 },
    )
  }
}
