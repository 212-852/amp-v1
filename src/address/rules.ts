export type AddressOption = {
  code: string
  label: string
}

export type AddressOptions = {
  prefectures: AddressOption[]
  cities_by_prefecture: Record<string, AddressOption[]>
}

export function normalize_address_code(value: unknown) {
  if (typeof value !== "string") {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function group_city_options(
  rows: Array<{ code: string; label: string; prefecture_code: string }>,
) {
  const grouped: Record<string, AddressOption[]> = {}

  for (const row of rows) {
    if (!grouped[row.prefecture_code]) {
      grouped[row.prefecture_code] = []
    }

    grouped[row.prefecture_code].push({
      code: row.code,
      label: row.label,
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

export function validate_address_selection(
  options: AddressOptions,
  input: {
    prefecture_code?: string | null
    city_code?: string | null
  },
) {
  if (
    input.prefecture_code &&
    !options.prefectures.some((option) => option.code === input.prefecture_code)
  ) {
    throw new Error("Invalid prefecture")
  }

  if (
    input.city_code &&
    !get_city_options(options, input.prefecture_code).some(
      (option) => option.code === input.city_code,
    )
  ) {
    throw new Error("Invalid city")
  }
}
