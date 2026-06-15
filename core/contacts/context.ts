export type ContactType = "line" | "email" | "push" | "discord"

export type ContactInput = {
  user_uuid?: unknown
  visitor_uuid?: unknown
  type?: unknown
  value?: unknown
}

export type ContactContext = {
  user_uuid: string | null
  visitor_uuid: string | null
  type: ContactType
  value: string
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function normalizeType(value: unknown): ContactType {
  return value === "line" ||
    value === "email" ||
    value === "push" ||
    value === "discord"
    ? value
    : "push"
}

export function normalizeContactContext(input: ContactInput): ContactContext {
  const user_uuid = normalizeString(input.user_uuid)
  const visitor_uuid = normalizeString(input.visitor_uuid)
  const type = normalizeType(input.type)
  const value = normalizeString(input.value)

  if (!value) {
    throw new Error("Contact requires a real destination value")
  }

  return {
    user_uuid,
    visitor_uuid,
    type,
    value,
  }
}
