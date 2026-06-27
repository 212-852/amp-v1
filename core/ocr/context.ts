import type { AuthContext, Session } from "@/core/auth/types"
import { read_ocr_document_type } from "@/core/ocr/rules"
import type {
  DriverLicenseParsedFields,
  OcrDocumentType,
} from "@/core/ocr/rules"
import {
  normalize_number,
  normalize_text,
  normalize_textarea,
} from "@/form/normalize"

export type OcrRequestInput = {
  document_type: OcrDocumentType
  image_url: string
}

export type OcrRequestContext = {
  auth: AuthContext
  session: Session
  input: OcrRequestInput
}

export function empty_driver_license_fields(): DriverLicenseParsedFields {
  return {
    license_name: "",
    license_address: "",
    license_birth_date: "",
    license_number: "",
    license_expiration_date: "",
  }
}

export function normalize_ocr_result(
  document_type: OcrDocumentType,
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return document_type === "driver_license_front"
      ? empty_driver_license_fields()
      : {}
  }

  const record = value as Record<string, unknown>

  if (document_type === "driver_license_front") {
    return {
      license_name: normalize_text(record.license_name),
      license_address: normalize_textarea(record.license_address),
      license_birth_date: normalize_text(record.license_birth_date),
      license_number: normalize_number(record.license_number),
      license_expiration_date: normalize_text(record.license_expiration_date),
    } satisfies DriverLicenseParsedFields
  }

  return Object.fromEntries(
    Object.entries(record).flatMap(([key, field]) => {
      const normalized = normalize_text(field)
      return normalized ? [[key, normalized]] : []
    }),
  )
}

export function merge_driver_license_fields(
  current: DriverLicenseParsedFields,
  parsed: Partial<DriverLicenseParsedFields>,
): DriverLicenseParsedFields {
  const normalized = normalize_ocr_result(
    "driver_license_front",
    parsed,
  ) as DriverLicenseParsedFields

  return {
    license_name: normalized.license_name || current.license_name,
    license_address: normalized.license_address || current.license_address,
    license_birth_date:
      normalized.license_birth_date || current.license_birth_date,
    license_number: normalized.license_number || current.license_number,
    license_expiration_date:
      normalized.license_expiration_date || current.license_expiration_date,
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function build_ocr_context(input: {
  auth: AuthContext
  session: Session
  body: Record<string, unknown>
}): OcrRequestContext {
  const document_type = read_ocr_document_type(input.body.document_type)

  return {
    auth: input.auth,
    session: input.session,
    input: {
      document_type: document_type ?? "driver_license_front",
      image_url: readString(input.body.image_url),
    },
  }
}
