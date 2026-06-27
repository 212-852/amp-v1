import { send_ocr_server_debug } from "@/core/ocr/server_debug"

let ocr_env_debug_logged = false

function read_env_string(name: string) {
  const value = process.env[name]

  if (typeof value !== "string") {
    return ""
  }

  return value.trim()
}

export function has_openai_api_key() {
  return Boolean(read_env_string("OPENAI_API_KEY"))
}

export function has_gemini_api_key() {
  return Boolean(read_env_string("GEMINI_API_KEY"))
}

export function read_openai_api_key() {
  return read_env_string("OPENAI_API_KEY")
}

export function read_gemini_api_key() {
  return read_env_string("GEMINI_API_KEY")
}

export function read_ocr_primary_provider() {
  const value = read_env_string("OCR_PRIMARY_PROVIDER").toLowerCase()

  if (value === "gemini") {
    return "gemini" as const
  }

  return "openai" as const
}

export function read_ocr_fallback_provider() {
  const value = read_env_string("OCR_FALLBACK_PROVIDER").toLowerCase()

  if (value === "gemini") {
    return "gemini" as const
  }

  if (value === "openai") {
    return "openai" as const
  }

  return null
}

export function ensure_ocr_env_loaded() {
  if (ocr_env_debug_logged) {
    return
  }

  ocr_env_debug_logged = true

  const has_openai = has_openai_api_key()
  const has_gemini = has_gemini_api_key()

  console.warn("[OPENAI_API_KEY_LOADED]", {
    has_openai_api_key: has_openai,
  })
  console.warn("[GEMINI_API_KEY_LOADED]", {
    has_gemini_api_key: has_gemini,
  })

  void send_ocr_server_debug("OPENAI_API_KEY_LOADED", {
    has_openai_api_key: has_openai,
  })
  void send_ocr_server_debug("GEMINI_API_KEY_LOADED", {
    has_gemini_api_key: has_gemini,
  })
}
