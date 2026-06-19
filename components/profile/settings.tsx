"use client"

import { X } from "lucide-react"
import { useEffect, useState } from "react"

import { useToast } from "@/components/ui/use_toast"
import type { ProfileDisplayPayload } from "@/core/profile/output"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"

const content = {
  title: {
    ja: "プロフィール設定",
    en: "Profile settings",
    es: "Configuracion de perfil",
  },
  display_name: {
    ja: "表示名",
    en: "Display name",
    es: "Nombre visible",
  },
  avatar_image: {
    ja: "アバター画像",
    en: "Avatar image",
    es: "Imagen de avatar",
  },
  avatar_placeholder: {
    ja: "画像URL",
    en: "Image URL",
    es: "URL de imagen",
  },
  role: {
    ja: "ロール",
    en: "Role",
    es: "Rol",
  },
  language: {
    ja: "言語",
    en: "Language",
    es: "Idioma",
  },
  notifications: {
    ja: "通知",
    en: "Notifications",
    es: "Notificaciones",
  },
  notification_all: {
    ja: "すべて",
    en: "All",
    es: "Todas",
  },
  notification_mentions: {
    ja: "メンションのみ",
    en: "Mentions only",
    es: "Solo menciones",
  },
  notification_none: {
    ja: "なし",
    en: "None",
    es: "Ninguna",
  },
  concierge_availability: {
    ja: "コンシェルジュ受付",
    en: "Concierge availability",
    es: "Disponibilidad de concierge",
  },
  save: {
    ja: "保存",
    en: "Save",
    es: "Guardar",
  },
  cancel: {
    ja: "キャンセル",
    en: "Cancel",
    es: "Cancelar",
  },
  saved: {
    ja: "保存しました",
    en: "Profile saved.",
    es: "Perfil guardado.",
  },
  failed: {
    ja: "保存に失敗しました",
    en: "Failed to save profile.",
    es: "No se pudo guardar el perfil.",
  },
  close: {
    ja: "閉じる",
    en: "Close",
    es: "Cerrar",
  },
} satisfies Record<string, Record<Locale, string>>

type NotificationPreference = ProfileDisplayPayload["notification_preference"]

export default function ProfileSettings({
  open,
  initial_profile,
  can_edit_concierge,
  concierge_available,
  onClose,
  onSaved,
}: Readonly<{
  open: boolean
  initial_profile: ProfileDisplayPayload
  can_edit_concierge: boolean
  concierge_available?: boolean
  onClose: () => void
  onSaved: (profile: ProfileDisplayPayload) => void
}>) {
  const { locale, set_locale } = useLocale()
  const { toast } = useToast()
  const [display_name, set_display_name] = useState(initial_profile.display_name)
  const [image_url, set_image_url] = useState(initial_profile.image_url ?? "")
  const [selected_locale, set_selected_locale] = useState<Locale>(
    initial_profile.locale,
  )
  const [notification_preference, set_notification_preference] =
    useState<NotificationPreference>(initial_profile.notification_preference)
  const [availability, set_availability] = useState(
    concierge_available === true,
  )
  const [is_saving, set_is_saving] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function load_profile() {
      const response = await fetch("/api/profile", { cache: "no-store" }).catch(
        () => null,
      )

      if (!response?.ok || cancelled) {
        return
      }

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        profile?: ProfileDisplayPayload
      } | null

      if (cancelled || payload?.ok !== true || !payload.profile) {
        return
      }

      set_display_name(payload.profile.display_name)
      set_image_url(payload.profile.image_url ?? "")
      set_selected_locale(payload.profile.locale)
      set_notification_preference(payload.profile.notification_preference)
    }

    void load_profile()

    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) {
    return null
  }

  async function save_profile() {
    if (is_saving) {
      return
    }

    set_is_saving(true)

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          display_name,
          image_url,
          locale: selected_locale,
          notification_preference,
          ...(can_edit_concierge
            ? { concierge_available: availability }
            : {}),
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        profile?: ProfileDisplayPayload
        error?: string
      } | null

      if (!response.ok || payload?.ok !== true || !payload.profile) {
        throw new Error(payload?.error ?? "profile_save_failed")
      }

      set_locale(payload.profile.locale)
      onSaved(payload.profile)
      window.dispatchEvent(
        new CustomEvent("amp-profile-updated", {
          detail: payload.profile,
        }),
      )

      if (typeof payload.profile.concierge_available === "boolean") {
        window.dispatchEvent(
          new CustomEvent("amp-concierge-availability-changed", {
            detail: { enabled: payload.profile.concierge_available },
          }),
        )
      }

      toast({
        tone: "success",
        message: content.saved[locale],
        compact: true,
        duration_ms: 2400,
      })
      onClose()
    } catch {
      toast({
        tone: "error",
        message: content.failed[locale],
        compact: true,
        duration_ms: 2800,
      })
    } finally {
      set_is_saving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 px-4 pb-4 pt-8">
      <section className="w-full max-w-[430px] rounded-2xl bg-white p-4 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold text-neutral-950">
            {content.title[locale]}
          </h2>
          <button
            type="button"
            aria-label={content.close[locale]}
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-900"
          >
            <X className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
              {content.display_name[locale]}
            </span>
            <input
              value={display_name}
              onChange={(event) => set_display_name(event.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
              {content.avatar_image[locale]}
            </span>
            <input
              value={image_url}
              placeholder={content.avatar_placeholder[locale]}
              onChange={(event) => set_image_url(event.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            />
          </label>

          <div>
            <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
              {content.role[locale]}
            </span>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[14px] text-neutral-700">
              {initial_profile.tier
                ? `${initial_profile.role} / ${initial_profile.tier}`
                : initial_profile.role}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
              {content.language[locale]}
            </span>
            <select
              value={selected_locale}
              onChange={(event) => set_selected_locale(event.target.value as Locale)}
              className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            >
              <option value="ja">JA</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
              {content.notifications[locale]}
            </span>
            <select
              value={notification_preference}
              onChange={(event) =>
                set_notification_preference(
                  event.target.value as NotificationPreference,
                )
              }
              className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            >
              <option value="all">{content.notification_all[locale]}</option>
              <option value="mentions">
                {content.notification_mentions[locale]}
              </option>
              <option value="none">{content.notification_none[locale]}</option>
            </select>
          </label>

          {can_edit_concierge ? (
            <label className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2">
              <span className="text-[13px] font-semibold text-neutral-700">
                {content.concierge_availability[locale]}
              </span>
              <input
                type="checkbox"
                checked={availability}
                onChange={(event) => set_availability(event.target.checked)}
                className="h-4 w-4 accent-neutral-900"
              />
            </label>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-200 px-3 py-2 text-[13px] font-semibold text-neutral-700"
          >
            {content.cancel[locale]}
          </button>
          <button
            type="button"
            disabled={is_saving}
            onClick={() => void save_profile()}
            className="rounded-md bg-neutral-950 px-3 py-2 text-[13px] font-semibold text-white disabled:bg-neutral-300"
          >
            {content.save[locale]}
          </button>
        </div>
      </section>
    </div>
  )
}
