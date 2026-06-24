"use client"

import { get_city_options, type AddressOptions } from "@/src/address/rules"
import { form_error_message_class, resolveFieldClass } from "@/form/validation"

export type AddressSelectorLabels = {
  prefecture: string
  city: string
  select_prefecture: string
  select_city: string
}

export type AddressSelectorClasses = {
  label?: string
  field_label?: string
  select?: string
}

export type AddressSelectorErrors = {
  prefecture_code?: string
  city_code?: string
}

export default function AddressSelector({
  options,
  prefecture_code,
  city_code,
  labels,
  classes,
  errors,
  onChange,
}: Readonly<{
  options: AddressOptions
  prefecture_code: string
  city_code: string
  labels: AddressSelectorLabels
  classes?: AddressSelectorClasses
  errors?: AddressSelectorErrors
  onChange: (value: { prefecture_code: string; city_code: string }) => void
}>) {
  const city_options = get_city_options(options, prefecture_code)
  const selectBaseClass = classes?.select ?? ""

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className={classes?.label ?? "block"}>
        <span className={classes?.field_label}>{labels.prefecture}</span>
        <select
          value={prefecture_code}
          onChange={(event) => {
            onChange({
              prefecture_code: event.target.value,
              city_code: "",
            })
          }}
          className={resolveFieldClass(selectBaseClass, errors?.prefecture_code)}
        >
          <option value="">{labels.select_prefecture}</option>
          {options.prefectures.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors?.prefecture_code ? (
          <span className={form_error_message_class} role="alert">
            {errors.prefecture_code}
          </span>
        ) : null}
      </label>
      <label className={classes?.label ?? "block"}>
        <span className={classes?.field_label}>{labels.city}</span>
        <select
          value={city_code ?? ""}
          disabled={!prefecture_code}
          onChange={(event) => {
            onChange({
              prefecture_code,
              city_code: event.target.value,
            })
          }}
          className={resolveFieldClass(selectBaseClass, errors?.city_code)}
        >
          <option value="">{labels.select_city}</option>
          {city_options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.city_name_ja ?? option.label}
            </option>
          ))}
        </select>
        {errors?.city_code ? (
          <span className={form_error_message_class} role="alert">
            {errors.city_code}
          </span>
        ) : null}
      </label>
    </div>
  )
}
