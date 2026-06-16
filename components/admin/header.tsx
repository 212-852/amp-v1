"use client"

import OpsHeader from "@/components/ops/header"
import type { Session } from "@/core/auth/types"
import {
  normalizeOpsHeaderSession,
  type OpsHeaderSession,
} from "@/core/ops/header_session"

export default function AdminHeader({
  session,
}: Readonly<{
  session?: Session | OpsHeaderSession | null
}>) {
  const header_session = normalizeOpsHeaderSession(session, {
    default_display_name: "Admin",
    default_role: "admin",
  })

  return <OpsHeader session={header_session} />
}
