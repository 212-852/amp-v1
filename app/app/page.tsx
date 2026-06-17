import { redirect } from "next/navigation"

import AppFooter from "@/components/app/footer"
import AppHeader from "@/components/app/header"
import AppHome from "@/components/app/home"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { resolveChatSupportAccess } from "@/core/chat/support"
import { resolveAmpRoute } from "@/core/route/rules"

export default async function AppPage() {
  const context = await resolveAuthContext()
  const [route, session] = await Promise.all([
    resolveAmpRoute(),
    resolveSession(context),
  ])

  if (route.path !== "/app") {
    redirect(route.path)
  }

  const support_access = resolveChatSupportAccess({
    user_uuid: session.user_uuid,
    role: session.role,
    tier: session.tier,
  })

  return (
    <div className="min-h-dvh bg-[#f5e8d5] text-[#3d2a19]">
      <AppHeader auth={session} />
      <AppHome />
      <AppFooter
        support_access={support_access}
        can_start_line_oauth={session.can_start_line_oauth}
      />
    </div>
  )
}
