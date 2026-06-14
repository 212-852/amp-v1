"use client"

import { Menu, MessageCircle, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import OpsNeko from "@/components/ops/neko"
import { useOverlay, type OverlayType } from "@/components/overlay"

const headerActions = [
  { label: "Chat", icon: MessageCircle },
  { label: "Settings", icon: Settings, overlayType: "menu" },
  { label: "Menu", icon: Menu, overlayType: "menu" },
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
  const { openOverlay } = useOverlay()
  const displayName = "Guest"
  const pageLabel = pageLabels[pathname] ?? "ダッシュボード"
  const breadcrumbs = [
    { label: "ホーム", href: "/admin" },
    { label: pageLabel, href: pathname },
  ]

  return (
    <header className="border-b border-neutral-200 bg-white px-5 pb-3 pt-[calc(10px+env(safe-area-inset-top,0px))]">
      <div className="mx-auto flex w-full max-w-[430px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
            <div className="absolute left-1/2 top-1.5 origin-top -translate-x-1/2 scale-[0.38]">
              <OpsNeko />
            </div>
          </div>

          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold leading-tight tracking-[-0.03em] text-neutral-950">
              {displayName}
            </p>
            <p className="mt-0.5 text-[12px] font-medium leading-tight text-neutral-500">
              admin
            </p>
            <nav
              aria-label="Breadcrumb"
              className="mt-1 flex min-w-0 items-center overflow-hidden text-[11px] font-medium leading-tight text-neutral-500"
            >
              {breadcrumbs.map((item, index) => (
                <span key={`${item.href}-${item.label}`} className="min-w-0">
                  {index > 0 ? (
                    <span className="px-1 text-neutral-400" aria-hidden="true">
                      &gt;
                    </span>
                  ) : null}
                  <Link
                    href={item.href}
                    aria-current={
                      index === breadcrumbs.length - 1 ? "page" : undefined
                    }
                    className="truncate text-neutral-500"
                  >
                    {item.label}
                  </Link>
                </span>
              ))}
            </nav>
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
                onClick={() => {
                  if (item.overlayType) {
                    openOverlay({
                      type: item.overlayType as OverlayType,
                      source: "admin",
                    })
                  }
                }}
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
