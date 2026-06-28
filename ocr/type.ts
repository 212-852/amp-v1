export type OcrDocumentType =
  | "driver_license_front"
  | "vehicle_inspection_certificate"
  | "black_plate"
  | "safety_manager_document"

export type OcrProvider = "openai" | "gemini"

export type OcrProviderPreference = OcrProvider | "default"

export type OcrInput = {
  document_type: OcrDocumentType
  image_base64?: string | null
  image_blob?: Blob | null
  provider_preference?: OcrProviderPreference | null
  request_id?: string | null
  component_instance_id?: string | null
}

export type NormalizedOcrInput = {
  document_type: OcrDocumentType
  image_data_url: string
  provider_preference: OcrProviderPreference
  request_id: string
  component_instance_id: string
}

export type OcrFields = Record<string, string>

export type OcrProviderResult = {
  fields: OcrFields
  confidence: number
  warnings: string[]
}

export type OcrValidation = {
  valid: boolean
  readable: boolean
  errors: Record<string, string>
}

export type OcrActionResult = {
  ok: boolean
  request_id: string
  document_type: OcrDocumentType
  provider: OcrProvider | null
  fields: OcrFields
  confidence: number
  warnings: string[]
  errors: Record<string, string>
}

export type OcrProviderRequest = {
  document_type: OcrDocumentType
  image_data_url: string
  request_id: string
  component_instance_id: string
}
