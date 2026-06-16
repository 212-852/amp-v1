"use client"

import AdminRenderFallback from "@/components/admin/fallback"

export default function AdminError({
  error,
}: Readonly<{
  error: Error & { digest?: string }
}>) {
  return <AdminRenderFallback message={error.message} />
}
