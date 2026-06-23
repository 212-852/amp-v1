"use client"

import type { FormEvent } from "react"
import { useMemo, useState } from "react"

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

type SubmitResponse = {
  ok?: boolean
  message?: string
  redirect_path?: string | null
  errors?: Record<string, string>
}

export default function EntryForm() {
  const addressState = useAddressOptions()
  const [prefectureCode, setPrefectureCode] = useState("")
  const [cityCode, setCityCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setMessage(null)
    setErrors({})

    try {
      const form = new FormData(event.currentTarget)
      const payload = Object.fromEntries(form.entries())

      const response = await fetch("/api/entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
      const result = (await response.json().catch(() => null)) as
        | SubmitResponse
        | null

      if (!response.ok || result?.ok !== true) {
        setErrors(result?.errors ?? {})
        setMessage(result?.message ?? "登録できませんでした。")
        return
      }

      setMessage(result.message ?? "登録を受け付けました。")

      window.setTimeout(() => {
        window.location.assign(result.redirect_path ?? "/app")
      }, 1200)
    } catch {
      setMessage("登録できませんでした。")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className={labelClass}>
        お名前
        <input name="name" className={fieldClass} autoComplete="name" />
      </label>

      <label className={labelClass}>
        電話番号
        <input name="phone" className={fieldClass} autoComplete="tel" />
      </label>

      <label className={labelClass}>
        メールアドレス
        <input
          name="email"
          type="email"
          className={fieldClass}
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
          name="address"
          className={fieldClass}
          autoComplete="street-address"
        />
      </label>

      <label className={labelClass}>
        車の所有
        <select name="car_owned" className={fieldClass}>
          <option value="">選択してください</option>
          <option value="yes">あり</option>
          <option value="no">なし</option>
        </select>
      </label>

      <label className={labelClass}>
        運転免許
        <select name="license_owned" className={fieldClass}>
          <option value="">選択してください</option>
          <option value="yes">あり</option>
          <option value="no">なし</option>
        </select>
      </label>

      <label className={labelClass}>
        稼働可能日
        <input
          name="available_days"
          className={fieldClass}
          placeholder="例: 平日夜、土日など"
        />
      </label>

      <label className={labelClass}>
        備考
        <textarea name="note" className={textAreaClass} />
      </label>

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
        className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-full bg-[#06C755] px-8 text-sm font-bold text-white shadow-[0_8px_18px_rgba(6,199,85,0.24)] disabled:opacity-60"
      >
        登録する
      </button>
    </form>
  )
}
