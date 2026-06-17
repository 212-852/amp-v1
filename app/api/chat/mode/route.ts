import { handleChatModeSwitch } from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"
import type { ChatRoomMode } from "@/core/chat/types"

export async function POST(request: Request) {
  try {
    const { context, session } = await resolveChatApiSession()
    const body = (await request.json().catch(() => ({}))) as {
      mode?: ChatRoomMode
    }

    if (!body.mode) {
      return Response.json({ error: "mode is required" }, { status: 400 })
    }

    const result = await handleChatModeSwitch({
      mode: body.mode,
      source_channel: context.source_channel,
      locale: context.locale,
      session,
    })

    return Response.json(result)
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to switch chat mode",
      },
      { status: 400 },
    )
  }
}
