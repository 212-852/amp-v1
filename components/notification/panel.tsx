"use client"

import { Bell, X } from "lucide-react"
import { useEffect } from "react"

import { notification_text } from "@/components/notification/content"
import NotificationScreen, {
  type NotificationPageState,
  type NotificationTab,
} from "@/components/notification/screen"
import type { NotificationType } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"

type NotificationPanelProps = {
  open: boolean
  initial_tab?: NotificationTab
  initial_state?: NotificationPageState | null
  onClose: () => void
  onSaved?: (notification_type: NotificationType) => void
}

export default function NotificationPanel({
  open,
  initial_tab = "notifications",
  initial_state = null,
  onClose,
  onSaved,
}: Readonly<NotificationPanelProps>) {
  const { locale } = useLocale()

  useEffect(() => {
    if (!open) {
      return
    }

    const previous_overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previous_overflow
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-[rgba(0,0,0,0.35)] px-4 py-[calc(env(safe-area-inset-top,0px)+24px)] backdrop-blur-[6px]"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation()
      }}
      onMouseDown={(event) => {
        event.stopPropagation()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[9999] max-h-[calc(100dvh-48px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] w-full max-w-[430px] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
        onClick={(event) => {
          event.stopPropagation()
        }}
        onMouseDown={(event) => {
          event.stopPropagation()
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Bell className="h-5 w-5 shrink-0 text-neutral-700" strokeWidth={1.8} />
            <h2 className="text-[16px] font-semibold text-neutral-950">
              {notification_text("panel_title", locale)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>

        <NotificationScreen
          initial_tab={initial_tab}
          initial_state={initial_state}
          onSaved={onSaved}
        />
      </div>
    </div>
  )
}
