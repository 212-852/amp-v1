import {
  merge_driver_license_fields,
  normalize_ocr_result,
} from "@/core/ocr/context"
import type { DriverLicenseParsedFields } from "@/core/ocr/rules"

export type MappedDriverLicenseForm = DriverLicenseParsedFields

export function map_ocr_to_license_form(
  parsed: Partial<DriverLicenseParsedFields>,
): MappedDriverLicenseForm {
  return normalize_ocr_result(
    "driver_license_front",
    parsed,
  ) as DriverLicenseParsedFields
}

export function apply_ocr_to_license_form(input: {
  current: DriverLicenseParsedFields
  mapped: MappedDriverLicenseForm
}) {
  return merge_driver_license_fields(input.current, input.mapped)
}
