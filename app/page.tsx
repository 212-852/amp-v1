import { headers } from "next/headers"
import { redirect, unstable_rethrow } from "next/navigation"

import LineAuthLoopBlocked from "@/components/access/line_auth_loop_blocked"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveIdentity } from "@/core/auth/identity"
import { send_line_auth_debug } from "@/core/auth/line_debug"
import { resolveLineBrowserAccess } from "@/core/auth/line_browser"
import { resolveAuthRoute } from "@/core/auth/route"
import { resolveSession } from "@/core/auth/session"
import { resolveEntranceContext } from "@/core/entrance/context"

export default async function Page() {
  try {
    const entrance = await resolveEntranceContext()
    const context = await resolveAuthContext("/")
    const session = await resolveSession(context)
    const identity = await resolveIdentity(context, session)
    const requestHeaders = await headers()
    const search = requestHeaders.get("x-amp-search")
    const line_access = await resolveLineBrowserAccess({
      context,
      session,
      identity,
      pathname: "/",
      search,
    })

    if (line_access.status === "loop_blocked") {
      return <LineAuthLoopBlocked />
    }

    if (line_access.status === "redirect_login") {
      await send_line_auth_debug("ENTRY_OPENED", {
        pathname: "/",
        return_to: line_access.return_to,
        redirect_to: line_access.redirect_to,
        redirect_reason: "line_identity_missing",
        has_session_cookie: Boolean(session.visitor_uuid),
        visitor_uuid_exists: Boolean(session.visitor_uuid),
        user_uuid_exists: Boolean(session.user_uuid),
        provider: session.provider,
        provider_user_id_exists: Boolean(session.provider_user_id),
        identity_exists: identity.identity_state === "linked",
        session_write_success: false,
      })

      redirect(line_access.redirect_to)
    }

    const route = resolveAuthRoute(context, entrance, session, identity)

    redirect(route.path)
  } catch (error) {
    unstable_rethrow(error)
    throw error
  }
}
