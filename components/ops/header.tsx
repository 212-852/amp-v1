"use client"

import { ChevronDown, MessageCircle, MessageCircleOff, Settings, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { useToast } from "@/components/ui/use_toast"
import { canToggleConciergeAvailability } from "@/core/chat/concierge_access"
import {
  normalizeOpsHeaderDisplay,
  type HeaderSessionLike,
  type OpsHeaderSession,
} from "@/core/ops/header_session"
import { concierge_toggle_content } from "@/core/ops/concierge_toggle_content"
import { useLocale } from "@/src/components/locale/provider"

export type { OpsHeaderSession, HeaderSessionLike } from "@/core/ops/header_session"

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

type HeaderMenuItem = {
  key: string
  label: string
  href?: string
  onClick?: () => void
}

export default function OpsHeader({
  session,
  page_label,
  concierge_available = true,
}: {
  session?: HeaderSessionLike | null
  page_label: string
  concierge_available?: boolean
}) {
  const safe_session = normalizeOpsHeaderDisplay(session)
  const { locale } = useLocale()
  const { toast } = useToast()
  const is_logged_in = Boolean(safe_session.user_uuid)
  const displayName = safe_session.display_name
  const roleLabel = is_logged_in ? safe_session.role : "Guest"
  const tierLabel = is_logged_in ? safe_session.tier : null
  const avatar_image_url = safe_session.image_url
  const menu_ref = useRef<HTMLDivElement>(null)
  const [menu_open, set_menu_open] = useState(false)
  const [is_logging_out, set_is_logging_out] = useState(false)
  const [concierge_available_state, set_concierge_available_state] = useState(
    concierge_available,
  )
  const [is_toggling_concierge, set_is_toggling_concierge] = useState(false)
  const can_toggle_concierge = canToggleConciergeAvailability({
    role: safe_session.role,
    tier: safe_session.tier,
  })

  useEffect(() => {
    set_concierge_available_state(concierge_available)
  }, [concierge_available])

  useEffect(() => {
    if (!menu_open) {
      return
    }

    function handle_pointer_down(event: MouseEvent | TouchEvent) {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (menu_ref.current?.contains(target)) {
        return
      }

      set_menu_open(false)
    }

    document.addEventListener("mousedown", handle_pointer_down)
    document.addEventListener("touchstart", handle_pointer_down)

    return () => {
      document.removeEventListener("mousedown", handle_pointer_down)
      document.removeEventListener("touchstart", handle_pointer_down)
    }
  }, [menu_open])

  function close_menu() {
    set_menu_open(false)
  }

  function toggle_menu() {
    set_menu_open((current) => !current)
  }

  async function toggle_concierge_availability() {
    if (!can_toggle_concierge || is_toggling_concierge) {
      return
    }

    const next = !concierge_available_state
    set_is_toggling_concierge(true)

    try {
      const response = await fetch("/api/chat/concierge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ available: next }),
      })

      if (!response.ok) {
        throw new Error("concierge_toggle_failed")
      }

      const payload = (await response.json()) as { available?: boolean }
      const resolved_available = payload.available ?? next

      set_concierge_available_state(resolved_available)
      toast({
        tone: "success",
        message: resolved_available
          ? concierge_toggle_content.on_success[locale]
          : concierge_toggle_content.off_success[locale],
      })
    } catch {
      toast({
        tone: "error",
        message: concierge_toggle_content.error[locale],
      })
    } finally {
      set_is_toggling_concierge(false)
    }
  }

  function handle_logout() {
    if (is_logging_out) {
      return
    }

    set_is_logging_out(true)
    close_menu()

    fetch("/api/auth/logout", {
      method: "POST",
    })
      .catch(() => null)
      .finally(() => {
        window.location.href = "/"
      })
  }

  const menu_items: HeaderMenuItem[] = [
    { key: "admin-home", label: "Admin Home", href: "/admin" },
    { key: "chat", label: "Chat" },
    { key: "settings", label: "Settings", href: "/admin/settings" },
  ]

  if (safe_session.can_logout) {
    menu_items.push({
      key: "logout",
      label: "Logout",
      onClick: handle_logout,
    })
  }

  return (
    <header className="relative z-40 border-b border-neutral-200 bg-white px-5 pb-3 pt-[calc(10px+env(safe-area-inset-top,0px))]">
      <div className="mx-auto flex w-full max-w-[430px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full border border-neutral-200 bg-neutral-50">
            {avatar_image_url ? (
              <img
                src={avatar_image_url}
                alt=""
                className="h-full w-full object-cover"
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
            <p className="mt-1 truncate text-[11px] font-medium leading-tight text-neutral-500">
              {page_label}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={
              concierge_available_state ? "Concierge ON" : "Concierge OFF"
            }
            aria-pressed={concierge_available_state}
            disabled={!can_toggle_concierge || is_toggling_concierge}
            onClick={
              can_toggle_concierge ? toggle_concierge_availability : undefined
            }
            className={[
              "relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
              concierge_available_state
                ? "border-[#22c55e] bg-[#dcfce7] ring-2 ring-[#22c55e]/30"
                : "border-[#d1d5db] bg-[#f3f4f6]",
              !can_toggle_concierge ? "opacity-60" : "",
            ].join(" ")}
          >
            {concierge_available_state ? (
              <>
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#22c55e]"
                />
                <MessageCircle
                  className="h-4 w-4 text-[#16a34a]"
                  strokeWidth={1.8}
                />
              </>
            ) : (
              <MessageCircleOff
                className="h-4 w-4 text-[#9ca3af]"
                strokeWidth={1.8}
              />
            )}
          </button>

          <Link
            href="/admin/settings"
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900"
          >
            <Settings className="h-4 w-4" strokeWidth={1.8} />
          </Link>

          <div ref={menu_ref} className="relative">
            <button
              type="button"
              aria-label="Menu"
              aria-expanded={menu_open}
              aria-haspopup="menu"
              onClick={toggle_menu}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900"
            >
              {menu_open ? (
                <X className="h-4 w-4" strokeWidth={1.8} />
              ) : (
                <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
              )}
            </button>

            <div
              role="menu"
              aria-label="Admin menu"
              aria-hidden={!menu_open}
              className={[
                "absolute right-0 top-[calc(100%+6px)] z-50 min-w-[168px] origin-top-right overflow-hidden rounded-2xl border border-neutral-200 bg-white py-1 shadow-[0_12px_32px_rgba(0,0,0,0.08)]",
                "transition-[opacity,transform] duration-150 ease-out",
                menu_open
                  ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                  : "pointer-events-none -translate-y-1 scale-95 opacity-0",
              ].join(" ")}
            >
              {menu_items.map((item) => {
                const item_class =
                  "flex w-full items-center px-3.5 py-2.5 text-left text-[13px] font-medium text-neutral-900 transition-colors hover:bg-neutral-50"

                if (item.href) {
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      role="menuitem"
                      tabIndex={menu_open ? 0 : -1}
                      className={item_class}
                      onClick={close_menu}
                    >
                      {item.label}
                    </Link>
                  )
                }

                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    tabIndex={menu_open ? 0 : -1}
                    className={item_class}
                    disabled={item.key === "logout" && is_logging_out}
                    onClick={() => {
                      item.onClick?.()
                      if (item.key !== "logout") {
                        close_menu()
                      }
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
