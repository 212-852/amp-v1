import type { AuthContext, Session } from "@/core/auth/types"
import type { DriverProgressKey } from "@/core/driver/progress/rules"

export type DriverProgressAppendInput = {
  item: DriverProgressKey
  status: string
  image_url?: string | null
}

export type DriverLicenseUploadInput = {
  image_url: string
  parsed?: Record<string, string>
}

export type DriverProgressRequestContext = {
  auth: AuthContext
  session: Session
  input: DriverProgressAppendInput
}

export type DriverLicenseRequestContext = {
  auth: AuthContext
  session: Session
  input: DriverLicenseUploadInput
}

function readProgressKey(value: unknown): DriverProgressKey {
  if (
    value === "driver_license" ||
    value === "vehicle" ||
    value === "freight_operator" ||
    value === "black_plate" ||
    value === "safety_manager"
  ) {
    return value
  }

  return "driver_license"
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function build_driver_progress_context(input: {
  auth: AuthContext
  session: Session
  body: Record<string, unknown>
}): DriverProgressRequestContext {
  return {
    auth: input.auth,
    session: input.session,
    input: {
      item: readProgressKey(input.body.item),
      status: readString(input.body.status),
      image_url: readString(input.body.image_url) || null,
    },
  }
}

export function build_driver_license_context(input: {
  auth: AuthContext
  session: Session
  body: Record<string, unknown>
}): DriverLicenseRequestContext {
  const parsed_record =
    input.body.parsed &&
    typeof input.body.parsed === "object" &&
    !Array.isArray(input.body.parsed)
      ? (input.body.parsed as Record<string, unknown>)
      : null

  const parsed = parsed_record
    ? Object.fromEntries(
        Object.entries(parsed_record).flatMap(([key, value]) =>
          typeof value === "string" ? [[key, value]] : [],
        ),
      )
    : undefined

  return {
    auth: input.auth,
    session: input.session,
    input: {
      image_url: readString(input.body.image_url),
      parsed,
    },
  }
}
