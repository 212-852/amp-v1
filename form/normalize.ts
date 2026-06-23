const FULL_WIDTH_DIGIT_START = 0xff10
const FULL_WIDTH_DIGIT_END = 0xff19
const FULL_WIDTH_UPPER_START = 0xff21
const FULL_WIDTH_UPPER_END = 0xff3a
const FULL_WIDTH_LOWER_START = 0xff41
const FULL_WIDTH_LOWER_END = 0xff5a
const FULL_WIDTH_SPACE = "\u3000"
const EDGE_SPACE_PATTERN = new RegExp(
  `^[\\s${FULL_WIDTH_SPACE}]+|[\\s${FULL_WIDTH_SPACE}]+$`,
  "g",
)

function read_input_string(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function to_half_width_alphanumeric(value: string) {
  let result = ""

  for (const character of value) {
    const code = character.charCodeAt(0)

    if (code >= FULL_WIDTH_DIGIT_START && code <= FULL_WIDTH_DIGIT_END) {
      result += String.fromCharCode(code - 0xfee0)
      continue
    }

    if (code >= FULL_WIDTH_UPPER_START && code <= FULL_WIDTH_UPPER_END) {
      result += String.fromCharCode(code - 0xfee0)
      continue
    }

    if (code >= FULL_WIDTH_LOWER_START && code <= FULL_WIDTH_LOWER_END) {
      result += String.fromCharCode(code - 0xfee0)
      continue
    }

    result += character
  }

  return result
}

function to_half_width_digits(value: string) {
  let result = ""

  for (const character of value) {
    const code = character.charCodeAt(0)

    if (code >= FULL_WIDTH_DIGIT_START && code <= FULL_WIDTH_DIGIT_END) {
      result += String.fromCharCode(code - 0xfee0)
      continue
    }

    result += character
  }

  return result
}

function trim_edges(value: string) {
  return value.replace(EDGE_SPACE_PATTERN, "")
}

export function normalize_text(value: unknown) {
  const input = read_input_string(value)

  if (!input) {
    return ""
  }

  return trim_edges(input)
}

export function normalize_textarea(value: unknown) {
  const input = read_input_string(value)

  if (!input) {
    return ""
  }

  const lines = input.split("\n")
  let start = 0
  let end = lines.length

  while (start < end && trim_edges(lines[start] ?? "") === "") {
    start += 1
  }

  while (end > start && trim_edges(lines[end - 1] ?? "") === "") {
    end -= 1
  }

  return lines.slice(start, end).join("\n")
}

export function normalize_number(value: unknown) {
  const half_width = to_half_width_digits(read_input_string(value))
  const without_spaces = half_width.replace(/[\s\u3000]/g, "")

  return without_spaces.replace(/\D/g, "")
}

export function normalize_phone(value: unknown) {
  const half_width = to_half_width_digits(read_input_string(value))
  const without_formatting = half_width.replace(
    /[\s\u3000\-ー－()（）]/g,
    "",
  )

  return without_formatting.replace(/\D/g, "")
}

export function normalize_postal_code(value: unknown) {
  const half_width = to_half_width_digits(read_input_string(value))
  const without_hyphen = half_width.replace(/[\s\u3000\-ー－]/g, "")
  const digits_only = without_hyphen.replace(/\D/g, "")

  return digits_only.slice(0, 7)
}

export function normalize_email(value: unknown) {
  const half_width = to_half_width_alphanumeric(read_input_string(value))
  const without_spaces = half_width.replace(/[\s\u3000]/g, "")
  const trimmed = trim_edges(without_spaces)

  if (!trimmed) {
    return ""
  }

  const at_index = trimmed.indexOf("@")

  if (at_index < 0) {
    return trimmed
  }

  const local_part = trimmed.slice(0, at_index)
  const domain_part = trimmed.slice(at_index + 1).toLowerCase()

  return `${local_part}@${domain_part}`
}

export function normalize_form_fields(
  body: Record<string, unknown>,
  fields: Record<string, (value: unknown) => string>,
) {
  const normalized: Record<string, unknown> = { ...body }

  for (const [key, normalizer] of Object.entries(fields)) {
    if (key in body) {
      normalized[key] = normalizer(body[key])
    }
  }

  return normalized
}

export function normalize_entry_form_body(body: Record<string, unknown>) {
  return normalize_form_fields(body, {
    last_name: normalize_text,
    first_name: normalize_text,
    phone: normalize_phone,
    email: normalize_email,
    prefecture: normalize_text,
    city: normalize_text,
    address: normalize_text,
    memo: normalize_textarea,
    application_reason: normalize_textarea,
  })
}

export function normalize_profile_form_body(body: Record<string, unknown>) {
  return normalize_form_fields(body, {
    nickname: normalize_text,
    first_name: normalize_text,
    last_name: normalize_text,
    phone: normalize_phone,
    prefecture: normalize_text,
    city: normalize_text,
    address: normalize_text,
    memo: normalize_textarea,
    birth_date: normalize_text,
  })
}
