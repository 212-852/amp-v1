import { redirect } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { resolve_user_has_line_identity } from "@/core/line/identity"
import { PARTNER_DRIVER_LIFF_URL } from "@/core/partner/recruitment"

export async function GET() {
  const context = await resolveAuthContext("/driver/register")
  const session = await resolveSession(context)
  const line_linked = await resolve_user_has_line_identity(session.user_uuid)

  if (!line_linked) {
    return new Response(
      "LINE連携にはログインが必要です。LINEでログイン後、もう一度この画面を開いてください。",
      {
        status: 403,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
        },
      },
    )
  }

  redirect(PARTNER_DRIVER_LIFF_URL)
}
