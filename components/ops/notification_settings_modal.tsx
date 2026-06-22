"use client"

import { Bell, X } from "lucide-react"
import { useEffect, useState } from "react"

import type { NotificationType } from "@/core/chat/types"
import {
  acquireFreshPushSubscription,
  type PushSubscriptionJson,
} from "@/core/notify/push_client"
import { useToast } from "@/components/ui/use_toast"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"
import { is_pwa_display_mode } from "@/src/pwa/display_mode"

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
  line_saved: {
    ja: "LINE通知へ変更しました",
    en: "Switched to LINE notifications",
    es: "Cambiado a notificaciones LINE",
  },
  push_saved: {
    ja: "PWA Push通知へ変更しました",
    en: "Switched to PWA Push notifications",
    es: "Cambiado a notificaciones push PWA",
  },
  push_disabled: {
    ja: "PWA Pushは現在選択できません",
    en: "PWA Push is not available right now",
    es: "Push PWA no esta disponible ahora",
  },
  push_denied: {
    ja: "通知許可が拒否されています",
    en: "Notification permission is denied",
    es: "El permiso de notificaciones esta denegado",
  },
  push_not_pwa: {
    ja: "PWAとして起動した時のみ選択できます",
    en: "Available only when launched as a PWA",
    es: "Disponible solo al iniciar como PWA",
  },
  push_unsupported: {
    ja: "このブラウザはPush通知に対応していません",
    en: "This browser does not support push notifications",
    es: "Este navegador no admite notificaciones push",
  },
  push_vapid_missing: {
    ja: "Push通知キーが未設定です",
    en: "Push notification key is not configured",
    es: "La clave push no esta configurada",
  },
  push_subscription_failed: {
    ja: "Push通知キーを取得できませんでした",
    en: "Failed to get push notification keys",
    es: "No se pudieron obtener las claves push",
  },
  line_identity_missing: {
    ja: "LINE連携情報が見つかりません",
    en: "LINE identity was not found",
    es: "No se encontro la identidad LINE",
  },
  save_failed: {
    ja: "通知設定の変更に失敗しました",
    en: "Failed to update notification settings",
    es: "Error al actualizar",
  },
} as const

type PushAvailability = {
  selectable: boolean
  reason: string | null
  permission: NotificationPermission | "unsupported"
}

function push_debug(event: string, payload: Record<string, unknown> = {}) {
  console.info(event, payload)
}

function can_start_pwa_push_setup() {
  return (
    typeof window !== "undefined" &&
    is_pwa_display_mode() &&
    "Notification" in window &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

function resolve_push_availability(locale: Locale): PushAvailability {
  if (typeof window === "undefined") {
    return {
      selectable: false,
      reason: content.push_unsupported[locale] ?? content.push_unsupported.en,
      permission: "unsupported",
    }
  }

  const is_pwa = is_pwa_display_mode()

  if (!is_pwa) {
    return {
      selectable: false,
      reason: content.push_not_pwa[locale] ?? content.push_not_pwa.en,
      permission: "Notification" in window
        ? window.Notification.permission
        : "unsupported",
    }
  }

  if (
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return {
      selectable: false,
      reason: content.push_unsupported[locale] ?? content.push_unsupported.en,
      permission: "unsupported",
    }
  }

  return {
    selectable: true,
    reason: null,
    permission: window.Notification.permission,
  }
}

function resolve_save_error_message(error: unknown, locale: Locale) {
  if (!(error instanceof Error)) {
    return content.save_failed[locale] ?? content.save_failed.en
  }

  if (error.message === "line_provider_user_id_missing") {
    return content.line_identity_missing[locale] ?? content.line_identity_missing.en
  }

  if (
    error.message === "push_subscription_required" ||
    error.message === "push_subscription_endpoint_required" ||
    error.message === "push_subscription_key_required"
  ) {
    return (
      content.push_subscription_failed[locale] ?? content.push_subscription_failed.en
    )
  }

  return error.message || (content.save_failed[locale] ?? content.save_failed.en)
}

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
  const { toast } = useToast()
  const [notification_type, set_notification_type] =
    useState<NotificationType>(initial_notification_type)
  const [saved_notification_type, set_saved_notification_type] =
    useState<NotificationType>(initial_notification_type)
  const [is_changing, set_is_changing] = useState(false)
  const [error_message, set_error_message] = useState<string | null>(null)
  const [push_availability, set_push_availability] = useState<PushAvailability>({
    selectable: false,
    reason: null,
    permission: "unsupported",
  })
  const [push_key_missing, set_push_key_missing] = useState(false)

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

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function load_notification_settings() {
      const response = await fetch("/api/chat/notifications", {
        credentials: "include",
        cache: "no-store",
      }).catch(() => null)

      if (!response?.ok || cancelled) {
        return
      }

      const payload = (await response.json().catch(() => null)) as {
        notification_type?: NotificationType
      } | null

      if (!cancelled) {
        const resolved_type =
          payload?.notification_type === "pwa_push" ? "pwa_push" : "line"
        set_notification_type(resolved_type)
        set_saved_notification_type(resolved_type)
        set_error_message(null)
      }
    }

    void load_notification_settings()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const timeout_id = window.setTimeout(() => {
      async function resolve_key_and_availability() {
        const is_pwa =
          typeof window !== "undefined" ? is_pwa_display_mode() : false
        let public_key: string | null = null
        let missing_env: string | null = null

        const availability = resolve_push_availability(locale as Locale)
        set_push_availability(availability)

        if (is_pwa) {
          const response = await fetch("/api/notify/push/key", {
            credentials: "include",
            cache: "no-store",
          }).catch(() => null)
          const payload = response?.ok
            ? ((await response.json().catch(() => null)) as {
                ok?: boolean
                public_key?: string | null
                missing_env?: string | null
              } | null)
            : null
          public_key =
            response?.ok && payload?.ok === true
              ? payload.public_key?.trim() || null
              : null
          missing_env = payload?.missing_env ?? null
        }

        set_push_key_missing(is_pwa && !public_key && Boolean(missing_env))
      }

      void resolve_key_and_availability()
    }, 0)

    return () => {
      window.clearTimeout(timeout_id)
    }
  }, [locale, open])

  async function fetch_vapid_public_key() {
    const response = await fetch("/api/notify/push/key", {
      credentials: "include",
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean
      public_key?: string | null
      missing_env?: string | null
    } | null
    const public_key =
      response.ok && payload?.ok === true ? payload.public_key?.trim() || null : null

    if (!public_key && payload?.missing_env) {
      set_push_key_missing(true)
      throw new Error(
        content.push_vapid_missing[locale as Locale] ??
          content.push_vapid_missing.en,
      )
    }

    set_push_key_missing(false)
    return public_key
  }

  function show_center_toast(input: {
    message: string
    tone: "success" | "error"
  }) {
    toast({
      tone: input.tone,
      placement: "center",
      duration_ms: 3000,
      message: input.message,
    })
  }

  async function persist_notification_settings(input: {
    notification_type: NotificationType
    push_subscription?: PushSubscriptionJson | null
  }) {
    const response = await fetch("/api/chat/notifications", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    })

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean
      notification_type?: NotificationType
      error?: string
    } | null

    if (!response.ok || payload?.ok !== true) {
      throw new Error(payload?.error ?? "notification_save_failed")
    }

    return payload.notification_type === "pwa_push" ? "pwa_push" : "line"
  }

  async function ensure_push_subscription() {
    const availability = resolve_push_availability(locale as Locale)
    set_push_availability(availability)

    if (!availability.selectable) {
      throw new Error(availability.reason ?? "pwa_push_unavailable")
    }

    if (window.Notification.permission === "denied") {
      throw new Error(content.push_denied[locale as Locale] ?? content.push_denied.en)
    }

    const public_key = await fetch_vapid_public_key()

    if (!public_key) {
      throw new Error(
        content.push_vapid_missing[locale as Locale] ??
          content.push_vapid_missing.en,
      )
    }

    if (window.Notification.permission === "default") {
      const permission = await window.Notification.requestPermission()

      if (permission !== "granted") {
        set_push_availability(resolve_push_availability(locale as Locale))
        throw new Error(content.push_denied[locale as Locale] ?? content.push_denied.en)
      }
    }

    const json = await acquireFreshPushSubscription({ public_key })
    const endpoint = json.endpoint?.trim()
    const p256dh = json.keys?.p256dh?.trim()
    const auth = json.keys?.auth?.trim()

    if (!endpoint || !p256dh || !auth) {
      throw new Error(
        content.push_subscription_failed[locale as Locale] ??
          content.push_subscription_failed.en,
      )
    }

    return json
  }

  async function select_line_notifications() {
    if (is_changing || saved_notification_type === "line") {
      return
    }

    set_is_changing(true)
    set_error_message(null)

    try {
      const saved_type = await persist_notification_settings({
        notification_type: "line",
      })
      set_notification_type(saved_type)
      set_saved_notification_type(saved_type)
      onSaved?.(saved_type)
      show_center_toast({
        message: content.line_saved[locale as Locale] ?? content.line_saved.en,
        tone: "success",
      })
    } catch (error) {
      set_notification_type(saved_notification_type)
      const message = resolve_save_error_message(error, locale as Locale)
      set_error_message(message)
      show_center_toast({ message, tone: "error" })
    } finally {
      set_is_changing(false)
    }
  }

  async function select_push_notifications() {
    if (is_changing || saved_notification_type === "pwa_push") {
      return
    }

    set_is_changing(true)
    set_error_message(null)

    try {
      const subscription = await ensure_push_subscription()
      const saved_type = await persist_notification_settings({
        notification_type: "pwa_push",
        push_subscription: subscription,
      })
      set_notification_type(saved_type)
      set_saved_notification_type(saved_type)
      onSaved?.(saved_type)
      show_center_toast({
        message: content.push_saved[locale as Locale] ?? content.push_saved.en,
        tone: "success",
      })
    } catch (error) {
      set_notification_type(saved_notification_type)
      const message = resolve_save_error_message(error, locale as Locale)
      set_error_message(message)
      show_center_toast({ message, tone: "error" })
    } finally {
      set_is_changing(false)
    }
  }

  if (!open) {
    return null
  }

  const push_option_disabled = !can_start_pwa_push_setup()

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
      disabled: push_option_disabled,
      helper: push_option_disabled
        ? push_availability.reason ??
          content.push_disabled[locale as Locale] ??
          content.push_disabled.en
        : push_key_missing
          ? content.push_vapid_missing[locale as Locale] ??
            content.push_vapid_missing.en
          : null,
    },
  ]

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
              {content.title[locale as Locale] ?? content.title.en}
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

        <div className="space-y-3">
          {options.map((option) => {
            const selected = notification_type === option.value

            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled || is_changing}
                aria-pressed={selected}
                onClick={() => {
                  if (option.value === "pwa_push") {
                    void select_push_notifications()
                    return
                  }

                  void select_line_notifications()
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
                  {option.value === "pwa_push" && is_changing && !selected ? (
                    <span className="mt-0.5 block text-[12px] leading-5 text-neutral-500">
                      {content.push[locale as Locale] ?? content.push.en}
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
      </div>
    </div>
  )
}
