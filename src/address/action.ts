import { getRestConfig, restHeaders, restUrl } from "@/core/db/rest"
import { normalize_address_context } from "@/src/address/context"
import { build_address_output } from "@/src/address/output"
import {
  group_city_options,
  validate_address_selection,
  type AddressOptions,
} from "@/src/address/rules"

type PrefectureRow = {
  prefecture_code: string
  label: string
}

type CityRow = {
  city_code: string
  prefecture_code: string
  label: string
}

async function load_prefectures() {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
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

  if (!response.ok) {
    return []
  }

  const rows = (await response.json()) as PrefectureRow[]
  return rows.map((row) => ({
    code: row.prefecture_code,
    label: row.label,
  }))
}

async function load_cities() {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(
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

  if (!response.ok) {
    return []
  }

  const rows = (await response.json()) as CityRow[]
  return rows.map((row) => ({
    code: row.city_code,
    label: row.label,
    prefecture_code: row.prefecture_code,
  }))
}

export async function get_address_options() {
  normalize_address_context("api")
  const [prefectures, cities] = await Promise.all([
    load_prefectures(),
    load_cities(),
  ])

  return build_address_output({
    prefectures,
    cities_by_prefecture: group_city_options(cities),
  })
}

export async function assert_valid_address_selection(input: {
  prefecture_code?: string | null
  city_code?: string | null
}) {
  normalize_address_context("profile")
  const options: AddressOptions = await get_address_options()
  validate_address_selection(options, input)
}
