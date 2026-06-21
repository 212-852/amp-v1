import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { logoutCurrentVisitor } from "@/core/auth/action"
import { sendAuthDebug } from "@/core/debug"

export async function POST(request: NextRequest) {
  try {
    return await logoutCurrentVisitor(request)
  } catch (error) {
    await sendAuthDebug("logout_request_failed", {
      error_message: error instanceof Error ? error.message : String(error),
      pathname: new URL(request.url).pathname,
    })

    return NextResponse.json(
      {
        ok: false,
        error: "logout_failed",
      },
      { status: 500 },
    )
  }
}
