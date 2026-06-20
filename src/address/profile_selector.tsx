"use client"

import AddressSelector, {
  type AddressSelectorClasses,
  type AddressSelectorLabels,
} from "@/src/address/selector"
import type { AddressOptions } from "@/src/address/rules"

export { useAddressOptions as useProfileAddressOptions } from "@/src/address/use_options"

export default function ProfileAddressSelector({
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
  return (
    <AddressSelector
      options={options}
      prefecture_code={prefecture_code}
      city_code={city_code}
      labels={labels}
      classes={classes}
      onChange={onChange}
    />
  )
}
