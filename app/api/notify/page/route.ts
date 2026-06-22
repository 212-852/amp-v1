import { NextResponse } from "next/server"

import { resolveChatApiSession } from "@/core/chat/api"
import { resolveNotificationPageContext } from "@/core/notify/context"

export const runtime = "nodejs"

export async function GET() {
  try {
    const { context, session } = await resolveChatApiSession()
    const page = await resolveNotificationPageContext({
      session,
      locale: context.locale ?? "ja",
    })

    return NextResponse.json({
      ok: true,
      ...page,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load notification page",
      },
      { status: 400 },
    )
  }
}
