import { NextResponse } from "next/server"

import { resolveChatApiSession } from "@/core/chat/api"
import {
  getNotificationSettings,
  normalizeNotificationType,
  saveNotificationSettings,
} from "@/core/notify/preferences"

export async function GET() {
  try {
    const { session } = await resolveChatApiSession()
    const settings = await getNotificationSettings(session)

    return NextResponse.json({
      ok: true,
      notification_type: settings.notification_type,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load notification settings",
      },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const notification_type = normalizeNotificationType(
    (body as { notification_type?: unknown } | null)?.notification_type,
  )

  if (!notification_type) {
    return NextResponse.json(
      { ok: false, error: "notification_type_required" },
      { status: 400 },
    )
  }

  try {
    const { session } = await resolveChatApiSession()
    const settings = await saveNotificationSettings({
      session,
      notification_type,
      push_subscription: (body as { push_subscription?: unknown } | null)
        ?.push_subscription,
    })

    return NextResponse.json({
      ok: true,
      notification_type: settings.notification_type,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update notification settings",
      },
      { status: 400 },
    )
  }
}
