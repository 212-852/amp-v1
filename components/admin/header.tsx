"use client"

import OpsHeader from "@/components/ops/header"
import {
  normalizeOpsHeaderSession,
  type HeaderSessionLike,
} from "@/core/ops/header_session"

export default function AdminHeader({
  session,
}: Readonly<{
  session?: HeaderSessionLike | null
}>) {
  const header_session = normalizeOpsHeaderSession(session, {
    default_display_name: "Admin",
    default_role: "admin",
  })

  return <OpsHeader session={header_session} />
}
