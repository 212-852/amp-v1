import { redirect } from "next/navigation"

import { resolveAmpRoute } from "@/core/route/rules"

export default async function Page() {
  const route = await resolveAmpRoute()

  redirect(route.path)
}
