import { NextResponse } from "next/server"

import {
  getConciergeAvailabilityState,
  toggleConciergeAvailability,
} from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"
import { ConciergeToggleDeniedError } from "@/core/chat/concierge_access"

export async function GET() {
  try {
    const { session } = await resolveChatApiSession()
    const state = await getConciergeAvailabilityState(session)
    return NextResponse.json({
      ok: true,
      enabled: state.enabled,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load concierge availability",
      },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  console.log("concierge body", body)

  const enabled = (body as { enabled?: unknown } | null)?.enabled
  console.log("concierge enabled", enabled, typeof enabled)

  if (typeof enabled !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "enabled_boolean_required", received: body },
      { status: 400 },
    )
  }

  try {
    const { session } = await resolveChatApiSession()

    const result = await toggleConciergeAvailability({
      enabled,
      session,
      request_body:
        body && typeof body === "object" && !Array.isArray(body)
          ? (body as Record<string, unknown>)
          : { enabled },
    })

    console.info("[concierge_toggle] concierge_toggle_success", {
      enabled: result.enabled,
      request_body: body,
    })

    return NextResponse.json({
      ok: true,
      enabled,
    })
  } catch (error) {
    if (error instanceof ConciergeToggleDeniedError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 403 },
      )
    }

    console.info("[concierge_toggle] concierge_toggle_failed", {
      request_body: body,
      enabled,
      error_message: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update concierge availability",
      },
      { status: 400 },
    )
  }
}
