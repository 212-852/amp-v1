import { getRestConfig, restHeaders, restUrl } from "@/core/db/rest"
import { normalize_address_context } from "@/src/address/context"
import { ADDRESS_OPTIONS } from "@/src/address/options"
import { build_address_output } from "@/src/address/output"
import {
  get_city_options,
  validate_address_selection,
  type AddressOptions,
} from "@/src/address/rules"
import { sendAuthDebug } from "@/core/debug"

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
  city_type?: string | null
}

type AddressOptionsInput = {
  prefecture_code?: string | null
  selected_city_code?: string | null
}

function build_db_address_options(input: {
  prefectures: Array<{ code: string; label: string }>
  cities: Array<{
    code: string
    label: string
    prefecture_code: string
    city_name_ja?: string | null
    city_type?: string | null
  }>
}): AddressOptions {
  const cities_by_prefecture: AddressOptions["cities_by_prefecture"] = {}

  for (const city of input.cities) {
    const current = cities_by_prefecture[city.prefecture_code] ?? []
    const selected_city_code = String(city.code)
    const selected_city_label = city.city_name_ja ?? city.label

    current.push({
      value: selected_city_code,
      code: selected_city_code,
      label: selected_city_label,
      city_name_ja: selected_city_label,
      city_type: city.city_type ?? null,
    })

    cities_by_prefecture[city.prefecture_code] = current
  }

  return {
    prefectures:
      input.prefectures.length > 0
        ? input.prefectures.map((prefecture) => ({
            value: prefecture.code,
            code: prefecture.code,
            label: prefecture.label,
          }))
        : ADDRESS_OPTIONS.prefectures,
    cities_by_prefecture,
  }
}

async function debug_profile_city_select(
  options: AddressOptions,
  input?: AddressOptionsInput,
) {
  const prefecture_code = input?.prefecture_code
    ? String(input.prefecture_code)
    : null
  const selected_city_code = input?.selected_city_code
    ? String(input.selected_city_code)
    : null

  if (!prefecture_code && !selected_city_code) {
    return
  }

  const city_options = prefecture_code
    ? get_city_options(options, prefecture_code)
    : Object.values(options.cities_by_prefecture).flat()
  const selected_city = city_options.find(
    (option) => option.value === selected_city_code,
  )
  const city_types = Array.from(
    new Set(
      city_options
        .map((option) => option.city_type)
        .filter((city_type): city_type is string => Boolean(city_type)),
    ),
  ).sort()

  await sendAuthDebug("PROFILE_CITY_SELECT", {
    prefecture_code,
    loaded_city_count: city_options.length,
    city_types,
    selected_city_code,
    selected_city_label:
      selected_city?.city_name_ja ?? selected_city?.label ?? null,
  })
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
    restUrl(
      config,
      "cities",
      "select=city_code,prefecture_code,city_name_ja,city_type&order=city_code.asc",
    ),
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
    city_name_ja: row.city_name_ja ?? row.label ?? row.city_code,
    city_type: row.city_type ?? null,
    prefecture_code: row.prefecture_code,
  }))
}

export async function get_address_options(input?: AddressOptionsInput) {
  normalize_address_context("api")

  const config = getRestConfig()

  if (!config) {
    const output = build_address_output(ADDRESS_OPTIONS)
    await debug_profile_city_select(output, input)
    return output
  }

  const [prefectures, cities] = await Promise.all([
    load_prefectures(),
    load_cities(),
  ])

  const options =
    cities.length > 0
      ? build_db_address_options({ prefectures, cities })
      : ADDRESS_OPTIONS
  const output = build_address_output(options)

  await debug_profile_city_select(output, input)

  return output
}

export async function assert_valid_address_selection(input: {
  prefecture_code?: string | null
  city_code?: string | null
}) {
  normalize_address_context("profile")
  const options: AddressOptions = await get_address_options()
  validate_address_selection(options, input)
}
