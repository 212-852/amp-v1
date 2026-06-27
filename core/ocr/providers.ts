import {
  ensure_ocr_env_loaded,
  read_gemini_api_key,
  read_ocr_fallback_provider,
  read_ocr_primary_provider,
  read_openai_api_key,
} from "@/core/ocr/env"

export type OcrProviderName = "openai" | "gemini"

export function load_ocr_provider_env() {
  ensure_ocr_env_loaded()
}

export function read_primary_provider(): OcrProviderName {
  return read_ocr_primary_provider()
}

export function read_fallback_provider(): OcrProviderName | null {
  return read_ocr_fallback_provider()
}

export function read_provider_api_key(provider: OcrProviderName) {
  ensure_ocr_env_loaded()

  if (provider === "gemini") {
    return read_gemini_api_key()
  }

  return read_openai_api_key()
}
