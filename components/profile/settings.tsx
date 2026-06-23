"use client"

import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { useToast } from "@/components/ui/use_toast"
import type { ProfilePayload } from "@/core/profile/output"
import ProfileAddressSelector, {
  useProfileAddressOptions,
} from "@/src/address/profile_selector"
import {
  resolve_address_labels,
  resolve_selected_city_code,
} from "@/src/address/rules"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"
import { ui_layer_class } from "@/src/ui/layers"

const content = {
  title: {
    ja: "プロフィール設定",
    en: "Profile settings",
    es: "Configuracion de perfil",
  },
  display_name: {
    ja: "ニックネーム",
    en: "Nickname",
    es: "Apodo",
  },
  first_name: {
    ja: "名",
    en: "First name",
    es: "Nombre",
  },
  last_name: {
    ja: "姓",
    en: "Last name",
    es: "Apellido",
  },
  birth_date: {
    ja: "生年月日",
    en: "Birth date",
    es: "Fecha de nacimiento",
  },
  phone: {
    ja: "電話番号",
    en: "Phone",
    es: "Telefono",
  },
  prefecture: {
    ja: "都道府県",
    en: "Prefecture",
    es: "Prefectura",
  },
  city: {
    ja: "市区町村",
    en: "City",
    es: "Ciudad",
  },
  address: {
    ja: "住所",
    en: "Address",
    es: "Direccion",
  },
  memo: {
    ja: "メモ",
    en: "Memo",
    es: "Memo",
  },
  language: {
    ja: "言語",
    en: "Language",
    es: "Idioma",
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
    ja: "保存できませんでした",
    en: "Could not save.",
    es: "No se pudo guardar.",
  },
  close: {
    ja: "閉じる",
    en: "Close",
    es: "Cerrar",
  },
  select_prefecture: {
    ja: "都道府県を選択",
    en: "Select prefecture",
    es: "Seleccionar prefectura",
  },
  select_city: {
    ja: "市区町村を選択",
    en: "Select city",
    es: "Seleccionar ciudad",
  },
  address_loading: {
    ja: "住所リストを読み込んでいます",
    en: "Loading address options",
    es: "Cargando opciones de direccion",
  },
  address_failed: {
    ja: "住所リストを読み込めませんでした",
    en: "Could not load address options",
    es: "No se pudieron cargar las opciones de direccion",
  },
} satisfies Record<string, Record<Locale, string>>

export default function ProfileSettings({
  open,
  initial_profile,
  onClose,
  onSaved,
}: Readonly<{
  open: boolean
  initial_profile: ProfilePayload
  onClose: () => void
  onSaved: (profile: ProfilePayload) => void
}>) {
  const { locale, set_locale } = useLocale()
  const { toast } = useToast()
  const [nickname, set_nickname] = useState(initial_profile.nickname ?? "")
  const [first_name, set_first_name] = useState(initial_profile.first_name ?? "")
  const [last_name, set_last_name] = useState(initial_profile.last_name ?? "")
  const [birth_date, set_birth_date] = useState(initial_profile.birth_date ?? "")
  const [phone, set_phone] = useState(initial_profile.phone ?? "")
  const [prefecture_code, set_prefecture_code] = useState(
    initial_profile.prefecture_code ?? "",
  )
  const [city_code, set_city_code] = useState(initial_profile.city_code ?? "")
  const [address, set_address] = useState(initial_profile.address ?? "")
  const [memo, set_memo] = useState(initial_profile.memo ?? "")
  const [selected_locale, set_selected_locale] = useState<Locale>(
    initial_profile.locale,
  )
  const [is_saving, set_is_saving] = useState(false)
  const address_state = useProfileAddressOptions()
  const address_options = address_state.options
  const selected_city_code = resolve_selected_city_code(
    address_options,
    prefecture_code,
    city_code,
  )
  const selected_address_labels = resolve_address_labels(address_options, {
    prefecture_code,
    city_code: selected_city_code,
  })

  useEffect(() => {
    if (!open) {
      return
    }

    window.dispatchEvent(
      new CustomEvent("amp-profile-settings-visibility", {
        detail: { open: true },
      }),
    )

    let cancelled = false

    async function load_profile() {
      const profile_response = await fetch("/api/profile", {
        cache: "no-store",
      }).catch(() => {
          return null
        })

      if (!profile_response?.ok || cancelled) {
        return
      }

      const payload = (await profile_response.json().catch(() => null)) as {
        ok?: boolean
        profile?: ProfilePayload
      } | null

      if (cancelled || payload?.ok !== true || !payload.profile) {
        return
      }

      set_nickname(payload.profile.nickname ?? "")
      set_first_name(payload.profile.first_name ?? "")
      set_last_name(payload.profile.last_name ?? "")
      set_birth_date(payload.profile.birth_date ?? "")
      set_phone(payload.profile.phone ?? "")
      set_prefecture_code(payload.profile.prefecture_code ?? "")
      set_city_code(payload.profile.city_code ?? "")
      set_address(payload.profile.address ?? "")
      set_memo(payload.profile.memo ?? "")
      set_selected_locale(payload.profile.locale)
    }

    void load_profile()

    return () => {
      cancelled = true
      window.dispatchEvent(
        new CustomEvent("amp-profile-settings-visibility", {
          detail: { open: false },
        }),
      )
    }
  }, [open])

  if (!open || typeof document === "undefined") {
    return null
  }

  async function save_profile() {
    if (is_saving) {
      return
    }

    set_is_saving(true)

    try {
      const payload = {
        nickname,
        first_name,
        last_name,
        birth_date,
        phone,
        prefecture: selected_address_labels.prefecture,
        city: selected_address_labels.city,
        language: selected_locale,
        prefecture_code,
        city_code: selected_city_code,
        address,
        memo,
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const response_payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        profile?: ProfilePayload
        error?: string
      } | null

      if (
        !response.ok ||
        response_payload?.ok !== true ||
        !response_payload.profile
      ) {
        throw new Error(response_payload?.error ?? "profile_save_failed")
      }

      set_nickname(response_payload.profile.nickname ?? "")
      set_first_name(response_payload.profile.first_name ?? "")
      set_last_name(response_payload.profile.last_name ?? "")
      set_birth_date(response_payload.profile.birth_date ?? "")
      set_phone(response_payload.profile.phone ?? "")
      set_prefecture_code(response_payload.profile.prefecture_code ?? "")
      set_city_code(response_payload.profile.city_code ?? "")
      set_address(response_payload.profile.address ?? "")
      set_memo(response_payload.profile.memo ?? "")
      set_selected_locale(response_payload.profile.locale)
      set_locale(response_payload.profile.locale)
      onSaved(response_payload.profile)
      window.dispatchEvent(
        new CustomEvent("amp-profile-updated", {
          detail: response_payload.profile,
        }),
      )

      toast({
        tone: "success",
        message: content.saved.ja,
        compact: true,
        duration_ms: 2400,
      })
      onClose()
    } catch (error) {
      const error_message =
        error instanceof Error ? error.message : content.failed[locale]

      toast({
        tone: "error",
        message: content.failed.ja,
        compact: true,
        duration_ms: 2800,
      })
    } finally {
      set_is_saving(false)
    }
  }

  return createPortal(
    <div
      className={[
        "fixed inset-0 flex items-end justify-center bg-black/30 px-4 pb-4 pt-8",
        ui_layer_class.overlay,
      ].join(" ")}
    >
      <section
        className={[
          "relative w-full max-w-[430px] rounded-2xl bg-white p-4 shadow-[0_18px_46px_rgba(0,0,0,0.18)]",
          ui_layer_class.modal,
        ].join(" ")}
      >
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
              value={nickname}
              onChange={(event) => set_nickname(event.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
                {content.first_name[locale]}
              </span>
              <input
                value={first_name}
                onChange={(event) => set_first_name(event.target.value)}
                className="h-10 w-full rounded-md border border-neutral-200 px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
                {content.last_name[locale]}
              </span>
              <input
                value={last_name}
                onChange={(event) => set_last_name(event.target.value)}
                className="h-10 w-full rounded-md border border-neutral-200 px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
              {content.birth_date[locale]}
            </span>
            <input
              type="date"
              value={birth_date}
              onChange={(event) => set_birth_date(event.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
              {content.phone[locale]}
            </span>
            <input
              value={phone}
              onChange={(event) => set_phone(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            />
          </label>

          {address_state.is_ready ? (
            <ProfileAddressSelector
              options={address_options}
              prefecture_code={prefecture_code}
              city_code={city_code}
              labels={{
                prefecture: content.prefecture[locale],
                city: content.city[locale],
                select_prefecture: content.select_prefecture[locale],
                select_city: content.select_city[locale],
              }}
              classes={{
                label: "block",
                field_label:
                  "mb-1 block text-[12px] font-semibold text-neutral-600",
                select:
                  "h-10 w-full rounded-md border border-neutral-200 px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100 disabled:bg-neutral-50 disabled:text-neutral-400",
              }}
              onChange={(value) => {
                set_prefecture_code(value.prefecture_code)
                set_city_code(value.city_code)
              }}
            />
          ) : (
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-500">
              {address_state.error_message
                ? content.address_failed[locale]
                : content.address_loading[locale]}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
              {content.address[locale]}
            </span>
            <input
              value={address}
              onChange={(event) => set_address(event.target.value)}
              className="h-10 w-full rounded-md border border-neutral-200 px-3 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-semibold text-neutral-600">
              {content.memo[locale]}
            </span>
            <textarea
              value={memo}
              rows={3}
              onChange={(event) => set_memo(event.target.value)}
              className="w-full resize-none rounded-md border border-neutral-200 px-3 py-2 text-[14px] text-neutral-950 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100"
            />
          </label>

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
    </div>,
    document.body,
  )
}
