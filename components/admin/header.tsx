import Link from "next/link"

import { AdminAccountIcon } from "@/components/admin/navigation"
import { AdminSectionNav } from "@/components/admin/nav"

export default function AdminHeader() {
  const AccountIcon = AdminAccountIcon

  return (
    <header className="sticky top-0 z-40 border-b border-[#e5e5e5] bg-[#ffffff] px-4 pt-[calc(14px+env(safe-area-inset-top,0px))]">
      <div className="mx-auto w-full max-w-6xl pb-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/admin" className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#777777]">
              AMP Admin
            </p>
            <h1 className="mt-1 truncate text-[22px] font-bold tracking-[-0.03em] text-[#111111]">
              Operations Console
            </h1>
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-[#ffffff]"
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
