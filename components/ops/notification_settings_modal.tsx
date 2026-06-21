"use client"

import { Bell } from "lucide-react"
import { useEffect, useState } from "react"

import type { NotificationType } from "@/core/chat/types"
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

type PushAvailability = {
  selectable: boolean
  reason: string | null
  permission: NotificationPermission | "unsupported"
}

type PushSubscriptionJson = {
  endpoint?: string
  expirationTime?: number | null
  keys?: Record<string, string>
}

function base64_url_to_uint8_array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  const output = new Uint8Array(raw.length)

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index)
  }

  return output
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

  push_debug("push_mode_detected", {
    is_pwa_display_mode: is_pwa,
    has_notification: "Notification" in window,
    has_service_worker:
      typeof navigator !== "undefined" && "serviceWorker" in navigator,
    has_push_manager: "PushManager" in window,
  })

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
  const [is_saving, set_is_saving] = useState(false)
  const [is_preparing_push, set_is_preparing_push] = useState(false)
  const [error_message, set_error_message] = useState<string | null>(null)
  const [push_availability, set_push_availability] = useState<PushAvailability>({
    selectable: false,
    reason: null,
    permission: "unsupported",
  })
  const [vapid_public_key, set_vapid_public_key] = useState<string | null>(null)
  const [push_subscription, set_push_subscription] =
    useState<PushSubscriptionJson | null>(null)
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

    const timeout_id = window.setTimeout(() => {
      set_notification_type(
        initial_notification_type === "pwa_push" ? "pwa_push" : "line",
      )
      set_error_message(null)
    }, 0)

    return () => {
      window.clearTimeout(timeout_id)
    }
  }, [initial_notification_type, open])

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
          push_debug("push_key_fetch_started", { source: "modal_open" })
          const response = await fetch("/api/notify/push/key", {
            credentials: "include",
            cache: "no-store",
          }).catch(() => null)
          const payload = response?.ok
            ? ((await response.json().catch(() => null)) as {
                ok?: boolean
                public_key?: string | null
                error?: string | null
                missing_env?: string | null
              } | null)
            : ((await response?.json().catch(() => null)) as {
                ok?: boolean
                public_key?: string | null
                error?: string | null
                missing_env?: string | null
              } | null)
          public_key =
            response?.ok && payload?.ok === true
              ? payload.public_key?.trim() || null
              : null
          missing_env = payload?.missing_env ?? null
          push_debug("push_key_fetch_response", {
            source: "modal_open",
            ok: response?.ok ?? false,
            status: response?.status ?? null,
            has_public_key: Boolean(public_key),
            error: payload?.error ?? null,
            missing_env: payload?.missing_env ?? null,
          })
        }

        set_vapid_public_key(public_key)
        set_push_key_missing(is_pwa && !public_key && Boolean(missing_env))

        if (!availability.selectable && notification_type === "pwa_push") {
          set_notification_type("line")
        }

        if (!availability.selectable) {
          console.info("[notification settings] pwa push disabled", {
            reason: availability.reason,
            permission: availability.permission,
            is_pwa_display_mode: is_pwa,
            has_notification:
              typeof window !== "undefined" && "Notification" in window,
            has_service_worker:
              typeof navigator !== "undefined" && "serviceWorker" in navigator,
            has_push_manager:
              typeof window !== "undefined" && "PushManager" in window,
            vapid_public_key_exists: Boolean(public_key),
          })
        }
      }

      void resolve_key_and_availability()
    }, 0)

    return () => {
      window.clearTimeout(timeout_id)
    }
  }, [locale, notification_type, open])

  async function fetch_vapid_public_key(source: string) {
    push_debug("push_key_fetch_started", { source })

    const response = await fetch("/api/notify/push/key", {
      credentials: "include",
      cache: "no-store",
    })
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean
      public_key?: string | null
      error?: string | null
      missing_env?: string | null
    } | null
    const public_key =
      response.ok && payload?.ok === true ? payload.public_key?.trim() || null : null

    push_debug("push_key_fetch_response", {
      source,
      ok: response.ok,
      status: response.status,
      has_public_key: Boolean(public_key),
      error: payload?.error ?? null,
      missing_env: payload?.missing_env ?? null,
    })

    set_vapid_public_key(public_key)

    if (!public_key && payload?.missing_env) {
      set_push_key_missing(true)
      push_debug("push_key_missing_env", {
        missing_env: payload.missing_env,
      })
      throw new Error(
        content.push_vapid_missing[locale as Locale] ??
          content.push_vapid_missing.en,
      )
    }

    set_push_key_missing(false)
    return public_key
  }

  function show_push_error(message: string) {
    set_error_message(message)
    toast({
      tone: "error",
      placement: "center",
      duration_ms: 3000,
      message,
    })
  }

  async function ensure_push_subscription() {
    const availability = resolve_push_availability(locale as Locale)
    set_push_availability(availability)

    if (!availability.selectable) {
      set_notification_type("line")
      throw new Error(availability.reason ?? "pwa_push_unavailable")
    }

    if (window.Notification.permission === "denied") {
      push_debug("push_permission_result", { permission: "denied" })
      throw new Error(content.push_denied[locale as Locale] ?? content.push_denied.en)
    }

    const public_key = await fetch_vapid_public_key("toggle_on")

    if (!public_key) {
      throw new Error(
        content.push_vapid_missing[locale as Locale] ??
          content.push_vapid_missing.en,
      )
    }

    if (window.Notification.permission === "default") {
      push_debug("push_permission_requested")
      const permission = await window.Notification.requestPermission()
      push_debug("push_permission_result", { permission })

      if (permission !== "granted") {
        const next_availability = resolve_push_availability(locale as Locale)
        set_push_availability(next_availability)
        set_notification_type("line")
        throw new Error(
          content.push_denied[locale as Locale] ?? content.push_denied.en,
        )
      }
    } else {
      push_debug("push_permission_result", {
        permission: window.Notification.permission,
      })
    }

    if (!(await navigator.serviceWorker.getRegistration("/"))) {
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      })
    }

    const registration = await navigator.serviceWorker.ready

    push_debug("push_subscribe_started")
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64_url_to_uint8_array(public_key ?? ""),
      }))

    const json = subscription.toJSON() as PushSubscriptionJson
    push_debug("push_subscribe_success", {
      endpoint_exists: Boolean(json.endpoint),
    })
    set_push_subscription(json)
    return json
  }

  async function persist_notification_settings(input: {
    notification_type: NotificationType
    push_subscription?: PushSubscriptionJson | null
  }) {
    if (input.notification_type === "pwa_push") {
      const response = await fetch("/api/notify/push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subscription: input.push_subscription }),
      })

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        notification_type?: NotificationType
        error?: string
      } | null

      if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.error ?? "push_subscription_save_failed")
      }

      push_debug("push_method_saved", { notification_type: "pwa_push" })
      return "pwa_push" as const
    }

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

    push_debug("push_method_saved", {
      notification_type:
        payload.notification_type === "pwa_push" ? "pwa_push" : "line",
    })
    return payload.notification_type === "pwa_push" ? "pwa_push" : "line"
  }

  async function select_push_notifications() {
    if (is_preparing_push) {
      return
    }

    set_is_preparing_push(true)
    set_error_message(null)

    try {
      const subscription = await ensure_push_subscription()
      const saved_type = await persist_notification_settings({
        notification_type: "pwa_push",
        push_subscription: subscription,
      })
      set_notification_type("pwa_push")
      onSaved?.(saved_type)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : content.push_disabled[locale as Locale] ?? content.push_disabled.en
      push_debug("push_subscribe_failed", { error_message: message })
      show_push_error(message)
    } finally {
      set_is_preparing_push(false)
    }
  }

  async function save_settings() {
    if (is_saving) {
      return
    }

    set_is_saving(true)
    set_error_message(null)

    try {
      const resolved_notification_type =
        notification_type === "pwa_push" ? "pwa_push" : "line"
      const resolved_push_subscription =
        resolved_notification_type === "pwa_push"
          ? push_subscription ?? (await ensure_push_subscription())
          : null

      const saved_type = await persist_notification_settings({
        notification_type: resolved_notification_type,
        push_subscription: resolved_push_subscription,
      })
      onSaved?.(saved_type)
      onClose()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : content.error[locale as Locale] ?? content.error.en
      show_push_error(message)
    } finally {
      set_is_saving(false)
    }
  }

  if (!open) {
    return null
  }

  const can_start_push_setup = can_start_pwa_push_setup()
  const push_option_disabled = !can_start_push_setup

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
      helper:
        push_option_disabled
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
                disabled={option.disabled || is_preparing_push || is_saving}
                aria-pressed={selected}
                onClick={() => {
                  if (option.value === "pwa_push") {
                    void select_push_notifications()
                    return
                  }

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
                  {option.value === "pwa_push" && is_preparing_push ? (
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
