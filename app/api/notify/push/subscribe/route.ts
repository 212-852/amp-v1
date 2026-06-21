import { NextResponse } from "next/server"

import { resolveChatApiSession } from "@/core/chat/api"
import { saveNotificationSettings } from "@/core/notify/preferences"
import { buildPushSubscribeOutput } from "@/core/notify/push_output"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    subscription?: unknown
  }

  try {
    const { session } = await resolveChatApiSession()
    const result = await saveNotificationSettings({
      session,
      notification_type: "pwa_push",
      push_subscription: body.subscription,
    })

    if (result.notification_type !== "pwa_push" || !("endpoint" in result)) {
      throw new Error("push_subscription_required")
    }

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
