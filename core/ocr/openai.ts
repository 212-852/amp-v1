import { read_openai_api_key } from "@/core/ocr/env"
import { send_ocr_server_debug } from "@/core/ocr/server_debug"

export async function request_openai_chat_completion(input: {
  document_type: string
  body: Record<string, unknown>
}) {
  const api_key = read_openai_api_key()

  if (!api_key) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  await send_ocr_server_debug("OPENAI_REQUEST_STARTED", {
    document_type: input.document_type,
    model: input.body.model ?? null,
  })

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
    cache: "no-store",
  })

  await send_ocr_server_debug("OPENAI_REQUEST_COMPLETED", {
    document_type: input.document_type,
    status: response.status,
    ok: response.ok,
  })

  if (!response.ok) {
    throw new Error(`OCR provider request failed (${response.status})`)
  }

  return response.json() as Promise<{
    choices?: Array<{ message?: { content?: string | null } }>
  }>
}
