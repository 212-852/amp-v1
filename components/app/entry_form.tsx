"use client"

import type { ChangeEvent, ClipboardEvent, FormEvent } from "react"
import { useMemo, useState } from "react"

import EntrySuccessScreen from "@/components/app/entry_success"
import type { EntryFormInitialValues } from "@/core/entry/context"
import { normalize_phone } from "@/form/normalize"
import AddressSelector from "@/src/address/selector"
import { useAddressOptions } from "@/src/address/use_options"
import {
  resolve_address_labels,
  resolve_selected_city_code,
} from "@/src/address/rules"

const fieldClass =
  "h-11 w-full rounded-md border border-[#d7b98f] bg-[#fffaf3] px-3 text-[15px] text-[#3d2a19] outline-none transition focus:border-[#a46a2a] focus:ring-2 focus:ring-[#a46a2a]/15"

const textAreaClass =
  "min-h-24 w-full resize-y rounded-md border border-[#d7b98f] bg-[#fffaf3] px-3 py-2 text-[15px] leading-6 text-[#3d2a19] outline-none transition focus:border-[#a46a2a] focus:ring-2 focus:ring-[#a46a2a]/15"

const labelClass = "grid gap-1.5 text-[13px] font-semibold text-[#5b422b]"

const sectionTitleClass = "text-[16px] font-bold text-[#3d2a19]"

const radioGroupClass = "grid gap-2 text-[14px] text-[#5b422b]"

const checkboxClass = "h-4 w-4 accent-[#06C755]"

type SubmitResponse = {
  ok?: boolean
  message?: string
  show_success?: boolean
  errors?: Record<string, string>
}

const petExperienceOptions = [
  { value: "dog", label: "犬" },
  { value: "cat", label: "猫" },
  { value: "other", label: "その他" },
  { value: "none", label: "飼育経験なし" },
] as const

export default function EntryForm({
  initial,
}: Readonly<{
  initial: EntryFormInitialValues
}>) {
  const addressState = useAddressOptions()
  const [prefectureCode, setPrefectureCode] = useState(initial.prefecture_code)
  const [cityCode, setCityCode] = useState(initial.city_code)
  const [phone, setPhone] = useState(normalize_phone(initial.phone))
  const [petExperience, setPetExperience] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const selectedCityCode = resolve_selected_city_code(
    addressState.options,
    prefectureCode,
    cityCode,
  )
  const selectedLabels = useMemo(
    () =>
      resolve_address_labels(addressState.options, {
        prefecture_code: prefectureCode,
        city_code: selectedCityCode,
      }),
    [addressState.options, prefectureCode, selectedCityCode],
  )

  function togglePetExperience(value: string) {
    setPetExperience((current) => {
      if (value === "none") {
        return current.includes("none") ? [] : ["none"]
      }

      const withoutNone = current.filter((item) => item !== "none")

      if (withoutNone.includes(value)) {
        return withoutNone.filter((item) => item !== value)
      }

      return [...withoutNone, value]
    })
  }

  function handle_phone_change(value: string) {
    setPhone(normalize_phone(value))
  }

  function handle_phone_paste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()

    const target = event.currentTarget
    const start = target.selectionStart ?? phone.length
    const end = target.selectionEnd ?? phone.length
    const pasted = event.clipboardData.getData("text")
    const next = `${phone.slice(0, start)}${pasted}${phone.slice(end)}`

    setPhone(normalize_phone(next))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    setErrors({})
    const normalizedPhone = normalize_phone(phone)
    setPhone(normalizedPhone)

    try {
      const form = new FormData(event.currentTarget)
      const payload = Object.fromEntries(form.entries())

      const response = await fetch("/api/entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          phone: normalizedPhone,
          has_driver_license: form.get("has_driver_license") === "on",
          pet_experience: petExperience,
        }),
      })
      const result = (await response.json().catch(() => null)) as
        | SubmitResponse
        | null

      if (!response.ok || result?.ok !== true) {
        setErrors(result?.errors ?? {})
        setMessage(result?.message ?? "登録できませんでした。")
        return
      }

      if (result.show_success) {
        setShowSuccess(true)
        return
      }

      setMessage(result.message ?? "登録を受け付けました。")
    } catch {
      setMessage("登録できませんでした。")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (showSuccess) {
    return <EntrySuccessScreen />
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <section className="grid gap-4">
        <h3 className={sectionTitleClass}>プロフィール</h3>

        <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
          <label className={labelClass}>
            姓
            <input
              type="text"
              name="last_name"
              className={fieldClass}
              defaultValue={initial.last_name}
              autoComplete="family-name"
            />
          </label>

          <label className={labelClass}>
            名
            <input
              type="text"
              name="first_name"
              className={fieldClass}
              defaultValue={initial.first_name}
              autoComplete="given-name"
            />
          </label>
        </div>

        <label className={labelClass}>
          電話番号
          <input
            type="tel"
            name="phone"
            className={`${fieldClass} phone_input`}
            value={phone}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              handle_phone_change(event.target.value)
            }
            onPaste={handle_phone_paste}
            onBlur={() => handle_phone_change(phone)}
            inputMode="numeric"
            autoComplete="tel"
            pattern="[0-9]*"
          />
        </label>

        <label className={labelClass}>
          メールアドレス
          <input
            name="email"
            type="email"
            className={fieldClass}
            defaultValue={initial.email}
            autoComplete="email"
          />
        </label>

        <AddressSelector
          options={addressState.options}
          prefecture_code={prefectureCode}
          city_code={cityCode}
          labels={{
            prefecture: "都道府県",
            city: "市区町村",
            select_prefecture: "都道府県を選択",
            select_city: "市区町村を選択",
          }}
          classes={{
            label: labelClass,
            field_label: "",
            select: fieldClass,
          }}
          onChange={(value) => {
            setPrefectureCode(value.prefecture_code)
            setCityCode(value.city_code)
          }}
        />
        <input type="hidden" name="prefecture_code" value={prefectureCode} />
        <input type="hidden" name="city_code" value={selectedCityCode} />
        <input
          type="hidden"
          name="prefecture"
          value={selectedLabels.prefecture ?? ""}
        />
        <input type="hidden" name="city" value={selectedLabels.city ?? ""} />

        <label className={labelClass}>
          住所
          <input
            type="text"
            name="address"
            className={fieldClass}
            defaultValue={initial.address}
            autoComplete="street-address"
          />
        </label>

      </section>

      <section className="grid gap-4 border-t border-[#ead7c3] pt-6">
        <h3 className={sectionTitleClass}>パートナードライバーの稼働条件</h3>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-[#5b422b]">
            普通自動車運転免許証
          </legend>
          <label className="flex items-center gap-2 text-[14px] text-[#5b422b]">
            <input
              type="checkbox"
              name="has_driver_license"
              className={checkboxClass}
            />
            普通自動車運転免許証を所持しています
          </label>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-[#5b422b]">
            ペット輸送可能な車両
          </legend>
          <div className={radioGroupClass}>
            <label className="flex items-center gap-2">
              <input type="radio" name="vehicle" value="owned" />
              所有している
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="vehicle" value="planned" />
              調達予定
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="vehicle" value="consult" />
              相談したい
            </label>
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-[#5b422b]">
            貨物軽自動車運送事業者
          </legend>
          <div className={radioGroupClass}>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="freight_operator"
                value="obtained"
              />
              取得済み
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="freight_operator"
                value="applying"
              />
              申請予定
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="freight_operator"
                value="unknown"
              />
              わからない
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="freight_operator"
                value="consult"
              />
              相談したい
            </label>
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-[#5b422b]">
            貨物軽自動車安全管理者
          </legend>
          <div className={radioGroupClass}>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="safety_manager"
                value="obtained"
              />
              取得済み
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="safety_manager" value="planned" />
              取得予定
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="safety_manager" value="unknown" />
              わからない
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="safety_manager" value="consult" />
              相談したい
            </label>
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-[#5b422b]">
            ペット飼育経験
          </legend>
          <div className={radioGroupClass}>
            {petExperienceOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={petExperience.includes(option.value)}
                  onChange={() => togglePetExperience(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-[#5b422b]">
            ペット輸送経験
          </legend>
          <div className={radioGroupClass}>
            <label className="flex items-center gap-2">
              <input type="radio" name="transport_experience" value="yes" />
              あり
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="transport_experience" value="no" />
              なし
            </label>
          </div>
        </fieldset>

        <label className={labelClass}>
          なぜパートナードライバーをやってみたいと思いましたか？
          <textarea
            name="application_reason"
            className={textAreaClass}
            placeholder="応募理由や動物への想い、現在の状況などをご記入ください"
          />
        </label>
      </section>

      {addressState.error_message ? (
        <p className="text-[13px] font-semibold text-red-700">
          住所リストを読み込めませんでした。
        </p>
      ) : null}

      {Object.keys(errors).length > 0 ? (
        <p className="text-[13px] font-semibold text-red-700">
          未入力または形式が正しくない項目があります。
        </p>
      ) : null}

      {message ? (
        <p className="rounded-md bg-[#fffaf3] px-3 py-2 text-center text-[14px] font-semibold text-[#5b422b] ring-1 ring-[#d7b98f]">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#06C755] px-8 text-sm font-bold text-white shadow-[0_8px_18px_rgba(6,199,85,0.24)] disabled:opacity-60"
      >
        {isSubmitting ? "送信中..." : "仮登録する"}
      </button>
    </form>
  )
}
