"use client"

import { Bell } from "lucide-react"
import { useEffect, useState } from "react"

import { isStandalonePwa } from "@/components/pwa/runtime"
import type { NotificationType } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"

const content = {
  title: {
    ja: "通知方法",
    en: "Notification Method",
    es: "Metodo de notificacion",
  },
  line: {
    ja: "LINE通知",
    en: "LINE Notification",
    es: "Notificacion LINE",
  },
  push: {
    ja: "PWA Push通知",
    en: "PWA Push Notification",
    es: "Notificacion push PWA",
  },
  push_disabled: {
    ja: "Push通知（PWAのみ）",
    en: "Push (PWA only)",
    es: "Push (solo PWA)",
  },
  save: {
    ja: "保存",
    en: "Save",
    es: "Guardar",
  },
  close: {
    ja: "閉じる",
    en: "Close",
    es: "Cerrar",
  },
  error: {
    ja: "通知設定の保存に失敗しました",
    en: "Failed to save notification settings",
    es: "Error al guardar",
  },
} as const

type NotificationSettingsModalProps = {
  open: boolean
  initial_notification_type: NotificationType
  onClose: () => void
  onSaved?: (notification_type: NotificationType) => void
}

export default function NotificationSettingsModal({
  open,
  initial_notification_type,
  onClose,
  onSaved,
}: Readonly<NotificationSettingsModalProps>) {
  const { locale } = useLocale()
  const [notification_type, set_notification_type] =
    useState<NotificationType>(initial_notification_type)
  const [is_saving, set_is_saving] = useState(false)
  const [error_message, set_error_message] = useState<string | null>(null)
  const push_available =
    isStandalonePwa() &&
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "granted"

  useEffect(() => {
    if (!open) {
      return
    }

    set_notification_type(initial_notification_type)
    set_error_message(null)
  }, [initial_notification_type, open])

  useEffect(() => {
    if (!push_available && notification_type === "push") {
      set_notification_type("line")
    }
  }, [notification_type, push_available])

  async function save_settings() {
    if (is_saving) {
      return
    }

    set_is_saving(true)
    set_error_message(null)

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notification_type }),
      })

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        profile?: { notification_type?: NotificationType }
        notification_type?: NotificationType
        error?: string
      } | null

      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error ?? "notification_save_failed")
      }

      const saved_type =
        payload.profile?.notification_type ??
        payload.notification_type ??
        notification_type
      onSaved?.(saved_type)
      onClose()
    } catch {
      set_error_message(content.error[locale as Locale] ?? content.error.en)
    } finally {
      set_is_saving(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:items-center">
      <div className="w-full max-w-[430px] rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-neutral-700" strokeWidth={1.8} />
          <h2 className="text-[16px] font-semibold text-neutral-950">
            {content.title[locale as Locale] ?? content.title.en}
          </h2>
        </div>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3">
            <input
              type="radio"
              name="notification_type"
              checked={notification_type === "line"}
              onChange={() => set_notification_type("line")}
              className="h-4 w-4"
            />
            <span className="text-[14px] font-medium text-neutral-900">
              {content.line[locale as Locale] ?? content.line.en}
            </span>
          </label>

          <label
            className={[
              "flex items-center gap-3 rounded-xl border px-4 py-3",
              push_available
                ? "cursor-pointer border-neutral-200"
                : "cursor-not-allowed border-neutral-100 bg-neutral-50 opacity-70",
            ].join(" ")}
          >
            <input
              type="radio"
              name="notification_type"
              checked={notification_type === "push"}
              disabled={!push_available}
              onChange={() => set_notification_type("push")}
              className="h-4 w-4"
            />
            <div className="min-w-0">
              <span className="block text-[14px] font-medium text-neutral-900">
                {content.push[locale as Locale] ?? content.push.en}
              </span>
              {!push_available ? (
                <span className="mt-0.5 block text-[12px] text-neutral-500">
                  {content.push_disabled[locale as Locale] ??
                    content.push_disabled.en}
                </span>
              ) : null}
            </div>
          </label>
        </div>

        {error_message ? (
          <p className="mt-3 text-[12px] font-medium text-red-600">
            {error_message}
          </p>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-4 py-2 text-[13px] font-medium text-neutral-700"
          >
            {content.close[locale as Locale] ?? content.close.en}
          </button>
          <button
            type="button"
            disabled={is_saving}
            onClick={() => void save_settings()}
            className="rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {content.save[locale as Locale] ?? content.save.en}
          </button>
        </div>
      </div>
    </div>
  )
}
