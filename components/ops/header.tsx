"use client"

import { Bell, ChevronDown, MessageCircle, Settings } from "lucide-react"
import { usePathname } from "next/navigation"

import OpsNeko from "@/components/ops/neko"

const headerActions = [
  { label: "Chat", icon: MessageCircle },
  { label: "Notifications", icon: Bell },
  { label: "Settings", icon: Settings },
  { label: "Open", icon: ChevronDown },
]

const pageLabels: Record<string, string> = {
  "/admin": "ダッシュボード",
  "/admin/orders": "注文管理",
  "/admin/drivers": "ドライバー管理",
  "/admin/concierge": "コンシェルジュ",
  "/admin/users": "ユーザー管理",
  "/admin/partners": "パートナー管理",
  "/admin/notifications": "通知",
  "/admin/settings": "設定",
}

export default function OpsHeader() {
  const pathname = usePathname()
  const displayName = "Guest"
  const pageLabel = pageLabels[pathname] ?? "ダッシュボード"

  return (
    <header className="border-b border-neutral-200 bg-white px-5 pb-4 pt-[calc(14px+env(safe-area-inset-top,0px))]">
      <div className="mx-auto flex min-h-[88px] w-full max-w-[430px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
            <div className="absolute left-1/2 top-2 origin-top -translate-x-1/2 scale-[0.42]">
              <OpsNeko />
            </div>
          </div>

          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold tracking-[-0.03em] text-neutral-950">
              {displayName}
            </p>
            <p className="mt-1 text-[13px] font-medium text-neutral-500">
              admin
            </p>
            <p className="mt-2 text-[13px] font-semibold tracking-[-0.02em] text-neutral-950">
              {pageLabel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {headerActions.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.label}
                type="button"
                aria-label={item.label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900"
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </button>
            )
          })}
        </div>
      </div>
    </header>
  )
}
