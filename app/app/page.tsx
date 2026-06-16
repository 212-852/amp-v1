import { redirect } from "next/navigation"

import AppFooter from "@/components/app/footer"
import AppHeader from "@/components/app/header"
import AppHome from "@/components/app/home"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveAuthUserProfile } from "@/core/auth/identity"
import { resolveSession } from "@/core/auth/session"
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

  const auth = await resolveAuthUserProfile(session.user_uuid)
  const headerAuth = {
    ...auth,
    role: session.role,
    tier: session.tier,
    can_logout: session.can_logout,
    can_start_line_oauth: session.can_start_line_oauth,
  }

  return (
    <div className="min-h-dvh bg-[#f5e8d5] text-[#3d2a19]">
      <AppHeader auth={headerAuth} />
      <AppHome />
      <AppFooter />
    </div>
  )
}
