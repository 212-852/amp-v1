import type { DriverLicenseOcrFields } from "@/core/ocr/rules"
import type { OcrDocumentType } from "@/core/ocr/rules"
import type { OcrValidationResult } from "@/core/ocr/rules"

export type OcrOutput = {
  ok: boolean
  message: string
  document_type?: OcrDocumentType
  fields?: DriverLicenseOcrFields
  errors?: Record<string, string>
}

export function build_ocr_validation_output(
  validation: OcrValidationResult,
): OcrOutput {
  return {
    ok: false,
    message: "入力内容を確認してください。",
    errors: validation.errors,
  }
}

export function build_ocr_access_denied_output(reason: string): OcrOutput {
  return {
    ok: false,
    message:
      reason === "login_required"
        ? "ログインが必要です。"
        : "ドライバー権限が必要です。",
  }
}

export function build_ocr_success_output(input: {
  document_type: OcrDocumentType
  fields: DriverLicenseOcrFields
}): OcrOutput {
  return {
    ok: true,
    message: "OCR読み込みが完了しました。",
    document_type: input.document_type,
    fields: input.fields,
  }
}
