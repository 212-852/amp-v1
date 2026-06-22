"use client"

import { useEffect, useState } from "react"

import NotificationAvailabilityToggle from "@/components/notification/availability_toggle"
import { notification_text } from "@/components/notification/content"
import type { NotificationType } from "@/core/chat/types"
import {
  acquireFreshPushSubscription,
  type PushSubscriptionJson,
} from "@/core/notify/push_client"
import { useToast } from "@/components/ui/use_toast"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"
import { is_pwa_display_mode } from "@/src/pwa/display_mode"

type PushAvailability = {
  selectable: boolean
  reason: string | null
  permission: NotificationPermission | "unsupported"
}

type NotificationSettingsProps = {
  initial_notification_type: NotificationType
  availability_enabled: boolean
  availability_can_toggle: boolean
  onSaved?: (notification_type: NotificationType) => void
  onAvailabilityChanged?: (enabled: boolean) => void
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
      reason: notification_text("push_unsupported", locale),
      permission: "unsupported",
    }
  }

  if (!is_pwa_display_mode()) {
    return {
      selectable: false,
      reason: notification_text("push_not_pwa", locale),
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
      reason: notification_text("push_unsupported", locale),
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
    return notification_text("save_failed", locale)
  }

  if (error.message === "line_provider_user_id_missing") {
    return notification_text("line_identity_missing", locale)
  }

  if (
    error.message === "push_subscription_required" ||
    error.message === "push_subscription_endpoint_required" ||
    error.message === "push_subscription_key_required"
  ) {
    return notification_text("push_subscription_failed", locale)
  }

  return error.message || notification_text("save_failed", locale)
}

export default function NotificationSettings({
  initial_notification_type,
  availability_enabled,
  availability_can_toggle,
  onSaved,
  onAvailabilityChanged,
}: Readonly<NotificationSettingsProps>) {
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
    set_notification_type(initial_notification_type)
    set_saved_notification_type(initial_notification_type)
  }, [initial_notification_type])

  useEffect(() => {
    const timeout_id = window.setTimeout(() => {
      async function resolve_key_and_availability() {
        const is_pwa =
          typeof window !== "undefined" ? is_pwa_display_mode() : false
        const availability = resolve_push_availability(locale)
        set_push_availability(availability)

        if (!is_pwa) {
          set_push_key_missing(false)
          return
        }

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
        const public_key =
          response?.ok && payload?.ok === true
            ? payload.public_key?.trim() || null
            : null

        set_push_key_missing(is_pwa && !public_key && Boolean(payload?.missing_env))
      }

      void resolve_key_and_availability()
    }, 0)

    return () => {
      window.clearTimeout(timeout_id)
    }
  }, [locale])

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
      throw new Error(notification_text("push_vapid_missing", locale))
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
    const availability = resolve_push_availability(locale)
    set_push_availability(availability)

    if (!availability.selectable) {
      throw new Error(availability.reason ?? "pwa_push_unavailable")
    }

    if (window.Notification.permission === "denied") {
      throw new Error(notification_text("push_denied", locale))
    }

    const public_key = await fetch_vapid_public_key()

    if (!public_key) {
      throw new Error(notification_text("push_vapid_missing", locale))
    }

    if (window.Notification.permission === "default") {
      const permission = await window.Notification.requestPermission()

      if (permission !== "granted") {
        set_push_availability(resolve_push_availability(locale))
        throw new Error(notification_text("push_denied", locale))
      }
    }

    const json = await acquireFreshPushSubscription({ public_key })
    const endpoint = json.endpoint?.trim()
    const p256dh = json.keys?.p256dh?.trim()
    const auth = json.keys?.auth?.trim()

    if (!endpoint || !p256dh || !auth) {
      throw new Error(notification_text("push_subscription_failed", locale))
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
        message: notification_text("line_saved", locale),
        tone: "success",
      })
    } catch (error) {
      set_notification_type(saved_notification_type)
      const message = resolve_save_error_message(error, locale)
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
        message: notification_text("push_saved", locale),
        tone: "success",
      })
    } catch (error) {
      set_notification_type(saved_notification_type)
      const message = resolve_save_error_message(error, locale)
      set_error_message(message)
      show_center_toast({ message, tone: "error" })
    } finally {
      set_is_changing(false)
    }
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
      label: notification_text("line", locale),
      disabled: false,
    },
    {
      value: "pwa_push",
      label: notification_text("push", locale),
      disabled: push_option_disabled,
      helper: push_option_disabled
        ? push_availability.reason ?? notification_text("push_disabled", locale)
        : push_key_missing
          ? notification_text("push_vapid_missing", locale)
          : null,
    },
  ]

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-[14px] font-semibold text-neutral-900">
          {notification_text("settings_method_title", locale)}
        </h3>
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
      </section>

      {availability_can_toggle ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-semibold text-neutral-900">
              {notification_text("settings_receive_title", locale)}
            </h3>
            <NotificationAvailabilityToggle
              enabled={availability_enabled}
              can_toggle={availability_can_toggle}
              onChanged={onAvailabilityChanged}
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
