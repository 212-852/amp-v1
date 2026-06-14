import Link from "next/link"

import { AdminAccountIcon } from "@/components/admin/navigation"
import { AdminSectionNav } from "@/components/admin/nav"

export default function AdminHeader() {
  const AccountIcon = AdminAccountIcon

  return (
    <header className="border-b border-neutral-200 bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto w-full max-w-[430px] px-4 py-3">
        <div className="flex h-12 items-center justify-between gap-4">
          <Link href="/admin" className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
              AMP Admin
            </p>
            <h1 className="mt-1 truncate text-sm font-semibold text-neutral-950">
              Admin App
            </h1>
          </Link>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-900"
            aria-label="Admin account"
          >
            <AccountIcon className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <AdminSectionNav />
      </div>
    </header>
  )
}
