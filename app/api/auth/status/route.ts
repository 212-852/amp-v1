import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import {
  applySessionCookies,
  restoreAuthSession,
} from "@/core/auth/restore"

export async function GET(request: NextRequest) {
  const result = await restoreAuthSession({
    request,
    requested_route: "/",
  })
  const authenticated = Boolean(result.session.user_uuid)
  const response = NextResponse.json({
    authenticated,
    user_uuid: result.session.user_uuid,
    role: authenticated ? result.session.role : null,
    route: result.route,
  })

  applySessionCookies(response, result.cookies)

  return response
}
