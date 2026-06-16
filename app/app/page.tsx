import { redirect } from "next/navigation"

import AppFooter from "@/components/app/footer"
import AppHeader from "@/components/app/header"
import AppHome from "@/components/app/home"
import { resolveAuthContext } from "@/core/auth/context"
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

  return (
    <div className="min-h-dvh bg-[#f5e8d5] text-[#3d2a19]">
      <AppHeader auth={session} />
      <AppHome />
      <AppFooter />
    </div>
  )
}
