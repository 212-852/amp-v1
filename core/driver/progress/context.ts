import type { AuthContext, Session } from "@/core/auth/types"
import type { DriverProgressKey } from "@/core/driver/progress/rules"
import {
  read_ocr_document_type,
  type OcrDocumentType,
} from "@/core/ocr/rules"
import {
  normalize_number,
  normalize_text,
  normalize_textarea,
} from "@/form/normalize"

export type DriverProgressAppendInput = {
  item: DriverProgressKey
  status: string
  image_url?: string | null
}

export type DriverLicenseUploadInput = {
  image_url: string
  license_name?: string
  license_address?: string
  license_birth_date?: string
  license_number?: string
  license_expiration_date?: string
}

export type DriverLicenseOcrInput = {
  document_type: OcrDocumentType
  image_url: string
  source: string
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

export type DriverLicenseOcrRequestContext = {
  auth: AuthContext
  session: Session
  input: DriverLicenseOcrInput
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

function readLicenseFields(body: Record<string, unknown>) {
  const parsed_record =
    body.parsed &&
    typeof body.parsed === "object" &&
    !Array.isArray(body.parsed)
      ? (body.parsed as Record<string, unknown>)
      : null

  const source = parsed_record ?? body

  return {
    license_name: normalize_text(source.license_name),
    license_address: normalize_textarea(source.license_address),
    license_birth_date: normalize_text(source.license_birth_date),
    license_number: normalize_number(source.license_number),
    license_expiration_date: normalize_text(source.license_expiration_date),
  }
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
  const fields = readLicenseFields(input.body)

  return {
    auth: input.auth,
    session: input.session,
    input: {
      image_url: readString(input.body.image_url),
      ...fields,
    },
  }
}

export function build_driver_license_ocr_context(input: {
  auth: AuthContext
  session: Session
  body: Record<string, unknown>
}): DriverLicenseOcrRequestContext {
  return {
    auth: input.auth,
    session: input.session,
    input: {
      document_type:
        read_ocr_document_type(input.body.document_type) ?? "driver_license_front",
      image_url: readString(input.body.image_url),
      source: readString(input.body.source),
    },
  }
}
