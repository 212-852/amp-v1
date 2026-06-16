"use client"

import OpsHeader from "@/components/ops/header"
import type { HeaderSessionLike } from "@/core/ops/header_session"

export default function AdminHeader({
  session,
}: Readonly<{
  session?: HeaderSessionLike | null
}>) {
  return <OpsHeader session={session} />
}
