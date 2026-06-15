import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession, VISITOR_COOKIE_NAME } from "@/core/auth/session"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { sendAuthDebug } from "@/core/debug"

function appBaseUrl(request: Request) {
  const requestUrl = new URL(request.url)

  if (requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1") {
    return requestUrl.origin
  }

  return (process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin).replace(/\/$/, "")
}

function clearRuntimeAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name === VISITOR_COOKIE_NAME) {
      continue
    }

    if (
      cookie.name === "sb-access-token" ||
      cookie.name === "sb-refresh-token" ||
      cookie.name === "supabase-auth-token" ||
      cookie.name.startsWith("sb-")
    ) {
      response.cookies.delete(cookie.name)
    }
  }
}

async function unlinkVisitorUser(visitor_uuid: string) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  const response = await fetch(
    restUrl(config, "visitors", `visitor_uuid=eq.${encodeURIComponent(visitor_uuid)}`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        user_uuid: null,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to logout visitor: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

export async function logoutCurrentVisitor(request: NextRequest) {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)
  const response = NextResponse.redirect(new URL("/", appBaseUrl(request)), 303)

  clearRuntimeAuthCookies(request, response)

  if (session.visitor_uuid) {
    await unlinkVisitorUser(session.visitor_uuid)
  }

  await sendAuthDebug("logout_success", {
    visitor_uuid: session.visitor_uuid,
    old_user_uuid: session.user_uuid,
    source_channel: context.source_channel,
  })

  return response
}
