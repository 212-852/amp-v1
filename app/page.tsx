import { redirect } from "next/navigation"

import AppFooter from "@/components/app/footer"
import AppHeader from "@/components/app/header"
import AppHome from "@/components/app/home"
import { resolveAmpRoute } from "@/core/route/rules"

export default async function Page() {
  const route = await resolveAmpRoute()

  if (route.path !== "/") {
    redirect(route.path)
  }

  return (
    <div className="min-h-dvh bg-[#f5e8d5] text-[#3d2a19]">
      <AppHeader />
      <AppHome />
      <AppFooter />
    </div>
  )
}
