import { redirect } from "next/navigation"

import { resolveAmpRouteForPath } from "@/core/route/rules"

export default async function Page() {
  const route = await resolveAmpRouteForPath("/")

  redirect(route.path)
}
