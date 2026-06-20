import { NextResponse } from "next/server"

import {
  getConciergeAvailabilityState,
  setConciergeNotificationType,
} from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"
import { ConciergeToggleDeniedError } from "@/core/chat/concierge_access"
import type { NotificationType } from "@/core/chat/types"

function parseNotificationType(value: unknown): NotificationType | null {
  return value === "line" || value === "push" ? value : null
}

export async function GET() {
  try {
    const { session } = await resolveChatApiSession()
    const state = await getConciergeAvailabilityState(session)

    return NextResponse.json({
      ok: true,
      availability: state.availability,
      notification_type: state.notification_type,
      enabled: state.enabled,
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
  const notification_type = parseNotificationType(
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
    const result = await setConciergeNotificationType({
      notification_type,
      session,
    })

    return NextResponse.json({
      ok: true,
      notification_type: result.notification_type,
    })
  } catch (error) {
    if (error instanceof ConciergeToggleDeniedError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 403 },
      )
    }

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
