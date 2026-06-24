import type { OcrRequestContext } from "@/core/ocr/context"
import {
  empty_driver_license_ocr_fields,
  normalize_driver_license_ocr_fields,
  type DriverLicenseOcrFields,
} from "@/core/ocr/rules"

async function run_driver_license_front_ocr(
  _image_url: string,
): Promise<DriverLicenseOcrFields> {
  void _image_url

  return empty_driver_license_ocr_fields()
}

export async function run_ocr(context: OcrRequestContext) {
  if (context.input.document_type === "driver_license_front") {
    const fields = await run_driver_license_front_ocr(context.input.image_url)

    return {
      document_type: context.input.document_type,
      fields: normalize_driver_license_ocr_fields(fields),
    }
  }

  return {
    document_type: context.input.document_type,
    fields: empty_driver_license_ocr_fields(),
  }
}
