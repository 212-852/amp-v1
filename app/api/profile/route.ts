import { NextResponse } from "next/server"

import { resolveChatApiSession } from "@/core/chat/api"
import {
  get_profile_settings,
  save_profile_settings,
} from "@/core/profile/action"

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
    const profile = await save_profile_settings({
      session,
      body,
    })

    return NextResponse.json({
      ok: true,
      profile,
    })
  } catch (error) {
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
