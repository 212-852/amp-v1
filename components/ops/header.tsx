"use client"

import { Menu, MessageCircle, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useOverlay, type OverlayType } from "@/components/overlay"
import type { OpsHeaderSession } from "@/core/ops/header_session"

export type { OpsHeaderSession } from "@/core/ops/header_session"

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

function resolveInitials(value: string | null | undefined) {
  const normalized = value?.trim()

  if (!normalized) {
    return "U"
  }

  const parts = normalized.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
  }

  return normalized.slice(0, 2).toUpperCase()
}

export default function OpsHeader({
  session,
}: {
  session?: OpsHeaderSession | null
}) {
  const pathname = usePathname()
  const { openOverlay } = useOverlay()
  const safe_session: OpsHeaderSession = {
    user_uuid: session?.user_uuid ?? null,
    role: session?.role ?? "admin",
    tier: session?.tier ?? null,
    display_name: session?.display_name ?? "Admin",
    image_url: session?.image_url ?? null,
  }
  const displayName = safe_session.display_name
  const roleLabel = safe_session.role
  const tierLabel = safe_session.tier
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
            {safe_session.image_url ? (
              <span
                className="block h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${safe_session.image_url})` }}
                aria-hidden="true"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-[17px] font-bold text-neutral-800">
                {resolveInitials(displayName)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="truncate text-[17px] font-semibold leading-tight tracking-[-0.03em] text-neutral-950">
              {displayName}
            </p>
            <p className="mt-0.5 text-[12px] font-medium leading-tight text-neutral-500">
              {tierLabel ? `${roleLabel} / ${tierLabel}` : roleLabel}
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
