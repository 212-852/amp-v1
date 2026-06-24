export type AddressOption = {
  value: string
  code: string
  label: string
  city_name_ja?: string | null
  city_type?: string | null
}

export type AddressOptions = {
  prefectures: AddressOption[]
  cities_by_prefecture: Record<string, AddressOption[]>
}

export function normalize_address_code(value: unknown) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const trimmed = String(value).trim()
  return trimmed ? trimmed : null
}

export function group_city_options(
  rows: Array<{
    code: string
    label: string
    prefecture_code: string
    city_name_ja?: string | null
    city_type?: string | null
  }>,
) {
  const grouped: Record<string, AddressOption[]> = {}

  for (const row of rows) {
    if (!grouped[row.prefecture_code]) {
      grouped[row.prefecture_code] = []
    }

    grouped[row.prefecture_code].push({
      value: row.code,
      code: row.code,
      label: row.label,
      city_name_ja: row.city_name_ja ?? row.label,
      city_type: row.city_type ?? null,
    })
  }

  return grouped
}

export function get_city_options(
  options: AddressOptions,
  prefecture_code: string | null | undefined,
) {
  if (!prefecture_code) {
    return []
  }

  return options.cities_by_prefecture[prefecture_code] ?? []
}

export function resolve_address_labels(
  options: AddressOptions,
  input: {
    prefecture_code?: string | null
    city_code?: string | null
  },
) {
  const prefecture =
    options.prefectures.find((option) => option.value === input.prefecture_code)
      ?.label ?? null
  const city_option = get_city_options(options, input.prefecture_code).find(
    (option) => option.value === input.city_code,
  )
  const city = city_option?.city_name_ja ?? city_option?.label ?? null

  return { prefecture, city }
}

export function validate_address_selection(
  options: AddressOptions,
  input: {
    prefecture_code?: string | null
    city_code?: string | null
  },
) {
  if (
    input.prefecture_code &&
    !options.prefectures.some((option) => option.value === input.prefecture_code)
  ) {
    throw new Error("Invalid prefecture")
  }

  if (
    input.city_code &&
    !get_city_options(options, input.prefecture_code).some(
      (option) => option.value === input.city_code,
    )
  ) {
    throw new Error("Invalid city")
  }
}
