import { redirect } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { resolve_user_has_line_identity } from "@/core/line/identity"
import { resolve_public_app_url } from "@/core/output/uri"
import { PARTNER_DRIVER_LIFF_URL } from "@/core/partner/recruitment"

export async function GET() {
  const context = await resolveAuthContext("/driver/register")
  const session = await resolveSession(context)
  const line_linked = await resolve_user_has_line_identity(session.user_uuid)

  if (!line_linked) {
    const app_url = resolve_public_app_url()

    if (app_url) {
      redirect(`${app_url}/app?line_link_required=1`)
    }

    redirect("/app?line_link_required=1")
  }

  redirect(PARTNER_DRIVER_LIFF_URL)
}
