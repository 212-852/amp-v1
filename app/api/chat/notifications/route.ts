import { NextResponse } from "next/server"

import { get_profile_settings, save_profile_settings } from "@/core/profile/action"
import { resolveChatApiSession } from "@/core/chat/api"
import { normalize_notification_type } from "@/core/profile/rules"

export async function GET() {
  try {
    const { session } = await resolveChatApiSession()
    const profile = await get_profile_settings(session)

    return NextResponse.json({
      ok: true,
      notification_type: profile.notification_type,
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
  const notification_type = normalize_notification_type(
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
    const profile = await save_profile_settings({
      session,
      body: { notification_type },
    })

    return NextResponse.json({
      ok: true,
      notification_type: profile.notification_type,
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
