import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  applySessionCookies,
  restoreAuthSession,
} from "@/core/auth/restore"

export async function GET(request: NextRequest) {
  const result = await restoreAuthSession({
    request,
    requested_route: request.nextUrl.pathname,
  })

  const response = NextResponse.json({
    ok: result.ok,
    restored: result.restored,
    session: result.session,
    identity: result.identity,
    route: result.route,
    error: result.error ?? null,
  })

  applySessionCookies(response, result.cookies)

  return response
}
