import { handleChatTyping } from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"

export async function POST(request: Request) {
  try {
    const { context, session } = await resolveChatApiSession()
    const body = (await request.json().catch(() => ({}))) as {
      is_typing?: boolean
    }

    const result = await handleChatTyping({
      is_typing: Boolean(body.is_typing),
      source_channel: context.source_channel,
      locale: context.locale,
      session,
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
