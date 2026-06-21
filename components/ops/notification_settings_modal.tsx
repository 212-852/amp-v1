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
    ja: "PWAで通知許可と購読が有効な場合のみ選択できます",
    en: "Available only when PWA notification permission and subscription are active",
    es: "Disponible solo con permiso y suscripcion push activos en PWA",
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
  const [push_available, set_push_available] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    set_notification_type(
      initial_notification_type === "pwa_push" ? "pwa_push" : "line",
    )
    set_error_message(null)
  }, [initial_notification_type, open])

  useEffect(() => {
    if (!push_available && notification_type === "pwa_push") {
      set_notification_type("line")
    }
  }, [notification_type, push_available])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function resolve_push_availability() {
      const has_push =
        isStandalonePwa() &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        "serviceWorker" in navigator &&
        "PushManager" in window

      if (!has_push) {
        if (!cancelled) {
          set_push_available(false)
        }
        return
      }

      try {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (!cancelled) {
          set_push_available(Boolean(subscription))
        }
      } catch {
        if (!cancelled) {
          set_push_available(false)
        }
      }
    }

    void resolve_push_availability()

    return () => {
      cancelled = true
    }
  }, [open])

  async function save_settings() {
    if (is_saving) {
      return
    }

    set_is_saving(true)
    set_error_message(null)

    try {
      const resolved_notification_type =
        notification_type === "pwa_push" && push_available ? "pwa_push" : "line"

      const response = await fetch("/api/chat/notifications", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notification_type: resolved_notification_type }),
      })

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        notification_type?: NotificationType
        error?: string
      } | null

      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error ?? "notification_save_failed")
      }

      const saved_type =
        payload.notification_type === "pwa_push" ? "pwa_push" : "line"
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

  const options: Array<{
    value: NotificationType
    label: string
    disabled: boolean
    helper?: string | null
  }> = [
    {
      value: "line",
      label: content.line[locale as Locale] ?? content.line.en,
      disabled: false,
    },
    {
      value: "pwa_push",
      label: content.push[locale as Locale] ?? content.push.en,
      disabled: !push_available,
      helper: !push_available
        ? content.push_disabled[locale as Locale] ?? content.push_disabled.en
        : null,
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/45 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:items-center sm:pb-0"
      role="presentation"
    >
      <div className="w-full max-w-[430px] rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-neutral-700" strokeWidth={1.8} />
          <h2 className="text-[16px] font-semibold text-neutral-950">
            {content.title[locale as Locale] ?? content.title.en}
          </h2>
        </div>

        <div className="space-y-3">
          {options.map((option) => {
            const selected = notification_type === option.value

            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                aria-pressed={selected}
                onClick={() => {
                  if (!option.disabled) {
                    set_notification_type(option.value)
                  }
                }}
                className={[
                  "flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left",
                  option.disabled
                    ? "cursor-not-allowed border-neutral-100 bg-neutral-50 opacity-70"
                    : "border-neutral-200 bg-white",
                ].join(" ")}
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-neutral-900">
                    {option.label}
                  </span>
                  {option.helper ? (
                    <span className="mt-0.5 block text-[12px] leading-5 text-neutral-500">
                      {option.helper}
                    </span>
                  ) : null}
                </span>
                <span
                  aria-hidden="true"
                  className={[
                    "relative h-8 w-[52px] shrink-0 rounded-full transition-colors",
                    selected ? "bg-[#34c759]" : "bg-neutral-300",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform",
                      selected ? "translate-x-[23px]" : "translate-x-1",
                    ].join(" ")}
                  />
                </span>
              </button>
            )
          })}
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
