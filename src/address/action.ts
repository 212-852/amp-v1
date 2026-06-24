import { getRestConfig, restHeaders, restUrl } from "@/core/db/rest"
import { normalize_address_context } from "@/src/address/context"
import { ADDRESS_OPTIONS } from "@/src/address/options"
import { build_address_output } from "@/src/address/output"
import {
  validate_address_selection,
  type AddressOptions,
} from "@/src/address/rules"

type PrefectureRow = {
  prefecture_code: string
  label?: string | null
  prefecture_name_ja?: string | null
}

type CityRow = {
  city_code: string
  prefecture_code: string
  label?: string | null
  city_name_ja?: string | null
}

function merge_address_options(input: {
  prefectures: Array<{ code: string; label: string }>
  cities: Array<{ code: string; label: string; prefecture_code: string }>
}): AddressOptions {
  const prefectures_by_code = new Map(
    ADDRESS_OPTIONS.prefectures.map((option) => [option.code, option]),
  )

  for (const prefecture of input.prefectures) {
    prefectures_by_code.set(prefecture.code, prefecture)
  }

  const cities_by_prefecture: AddressOptions["cities_by_prefecture"] = {}

  for (const [prefecture_code, cities] of Object.entries(
    ADDRESS_OPTIONS.cities_by_prefecture,
  )) {
    cities_by_prefecture[prefecture_code] = [...cities]
  }

  for (const city of input.cities) {
    const current = cities_by_prefecture[city.prefecture_code] ?? []
    const next = { code: city.code, label: city.label }
    const existing_index = current.findIndex((option) => option.code === city.code)

    if (existing_index >= 0) {
      current[existing_index] = next
    } else {
      current.push(next)
    }

    cities_by_prefecture[city.prefecture_code] = current
  }

  return {
    prefectures: [...prefectures_by_code.values()],
    cities_by_prefecture,
  }
}

async function load_prefectures() {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  let response = await fetch(
    restUrl(config, "prefectures", "select=prefecture_code,prefecture_name_ja&order=prefecture_code.asc"),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    response = await fetch(
      restUrl(
        config,
        "prefectures",
        "select=prefecture_code,label&order=sort_order.asc",
      ),
      {
        headers: restHeaders(config),
        cache: "no-store",
      },
    )
  }

  if (!response.ok) {
    return []
  }

  const rows = (await response.json()) as PrefectureRow[]
  return rows.map((row) => ({
    code: row.prefecture_code,
    label: row.prefecture_name_ja ?? row.label ?? row.prefecture_code,
  }))
}

async function load_cities() {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  let response = await fetch(
    restUrl(config, "cities", "select=city_code,prefecture_code,city_name_ja&order=city_code.asc"),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    response = await fetch(
      restUrl(
        config,
        "cities",
        "select=city_code,prefecture_code,label&order=sort_order.asc",
      ),
      {
        headers: restHeaders(config),
        cache: "no-store",
      },
    )
  }

  if (!response.ok) {
    return []
  }

  const rows = (await response.json()) as CityRow[]
  return rows.map((row) => ({
    code: row.city_code,
    label: row.city_name_ja ?? row.label ?? row.city_code,
    prefecture_code: row.prefecture_code,
  }))
}

export async function get_address_options() {
  normalize_address_context("api")

  const config = getRestConfig()

  if (!config) {
    return build_address_output(ADDRESS_OPTIONS)
  }

  const [prefectures, cities] = await Promise.all([
    load_prefectures(),
    load_cities(),
  ])

  return build_address_output(merge_address_options({ prefectures, cities }))
}

export async function assert_valid_address_selection(input: {
  prefecture_code?: string | null
  city_code?: string | null
}) {
  normalize_address_context("profile")
  const options: AddressOptions = await get_address_options()
  validate_address_selection(options, input)
}
