"use client"

import OpsHeader from "@/components/ops/header"
import type { HeaderSessionLike } from "@/core/ops/header_session"

export default function AdminHeader({
  session,
  page_label,
}: Readonly<{
  session?: HeaderSessionLike | null
  page_label: string
}>) {
  return <OpsHeader session={session} page_label={page_label} />
}
