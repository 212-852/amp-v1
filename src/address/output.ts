import type { AddressOptions } from "@/src/address/rules"

export function build_address_output(options: AddressOptions) {
  return {
    prefectures: options.prefectures,
    cities_by_prefecture: options.cities_by_prefecture,
  }
}
