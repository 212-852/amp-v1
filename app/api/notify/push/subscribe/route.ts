import { NextResponse } from "next/server"

import { resolveChatApiSession } from "@/core/chat/api"
import { savePushSubscription } from "@/core/notify/push_action"
import { buildPushSubscribeOutput } from "@/core/notify/push_output"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    subscription?: unknown
  }

  try {
    const { session } = await resolveChatApiSession()
    const result = await savePushSubscription({
      session,
      subscription: body.subscription,
      user_agent: request.headers.get("user-agent"),
    })

    return NextResponse.json(buildPushSubscribeOutput(result))
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save push subscription",
      },
      { status: 400 },
    )
  }
}

