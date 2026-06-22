import { NextResponse } from "next/server"

import { resolveChatApiSession } from "@/core/chat/api"
import {
  get_profile_settings,
  save_profile_settings,
} from "@/core/profile/action"

function log_profile_debug(event: string, payload: Record<string, unknown>) {
  void event
  void payload
}

export async function GET() {
  try {
    const { session } = await resolveChatApiSession()
    const profile = await get_profile_settings(session)

    return NextResponse.json({
      ok: true,
      profile,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to load profile",
      },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await resolveChatApiSession()
    const body = await request.json().catch(() => ({}))
    log_profile_debug("profile_save_payload", {
      user_uuid: session.user_uuid ?? null,
      visitor_uuid: session.visitor_uuid ?? null,
      fields: Object.keys(body as Record<string, unknown>),
      payload: body,
    })
    const profile = await save_profile_settings({
      session,
      body,
    })

    log_profile_debug("profile_save_success", {
      user_uuid: session.user_uuid ?? null,
      visitor_uuid: session.visitor_uuid ?? null,
      display_name: profile.display_name,
    })

    return NextResponse.json({
      ok: true,
      profile,
    })
  } catch (error) {
    log_profile_debug("profile_save_failed", {
      error_message:
        error instanceof Error ? error.message : "Failed to save profile",
    })

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to save profile",
      },
      { status: 400 },
    )
  }
}
