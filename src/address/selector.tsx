"use client"

import { get_city_options, type AddressOptions } from "@/src/address/rules"

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

export default function AddressSelector({
  options,
  prefecture_code,
  city_code,
  labels,
  classes,
  onChange,
}: Readonly<{
  options: AddressOptions
  prefecture_code: string
  city_code: string
  labels: AddressSelectorLabels
  classes?: AddressSelectorClasses
  onChange: (value: { prefecture_code: string; city_code: string }) => void
}>) {
  const city_options = get_city_options(options, prefecture_code)
  const selected_city_code = city_options.some(
    (option) => option.value === city_code,
  )
    ? city_code
    : ""

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
          className={classes?.select}
        >
          <option value="">{labels.select_prefecture}</option>
          {options.prefectures.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={classes?.label ?? "block"}>
        <span className={classes?.field_label}>{labels.city}</span>
        <select
          value={selected_city_code}
          disabled={!prefecture_code}
          onChange={(event) => {
            onChange({
              prefecture_code,
              city_code: event.target.value,
            })
          }}
          className={classes?.select}
        >
          <option value="">{labels.select_city}</option>
          {city_options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.city_name_ja ?? option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
