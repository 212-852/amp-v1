import type { AuthContext, Session } from "@/core/auth/types"
import { read_ocr_document_type } from "@/core/ocr/rules"
import type { OcrDocumentType } from "@/core/ocr/rules"

export type OcrRequestInput = {
  document_type: OcrDocumentType
  image_url: string
}

export type OcrRequestContext = {
  auth: AuthContext
  session: Session
  input: OcrRequestInput
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
