import { read_gemini_api_key } from "@/core/ocr/env"
import { send_ocr_server_debug } from "@/core/ocr/server_debug"

type GeminiImagePart = {
  inline_data: {
    mime_type: string
    data: string
  }
}

function parse_data_url(image_url: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(image_url)

  if (!match) {
    throw new Error("Gemini OCR requires a base64 data URL image")
  }

  return {
    mime_type: match[1] ?? "image/jpeg",
    data: match[2] ?? "",
  }
}

export async function request_gemini_ocr(input: {
  document_type: string
  image_url: string
  prompt: string
}) {
  const api_key = read_gemini_api_key()

  if (!api_key) {
    throw new Error("GEMINI_API_KEY is not configured")
  }

  const image_part: GeminiImagePart = {
    inline_data: parse_data_url(input.image_url),
  }

  const model = process.env.GEMINI_OCR_MODEL ?? "gemini-2.0-flash"
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(api_key)}`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input.prompt }, image_part],
        },
      ],
    }),
    cache: "no-store",
  })

  await send_ocr_server_debug("OCR_PROVIDER_GEMINI_REQUEST_COMPLETED", {
    document_type: input.document_type,
    model,
    status: response.status,
    ok: response.ok,
  })

  if (!response.ok) {
    throw new Error(`Gemini OCR request failed (${response.status})`)
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string | null }>
      }
    }>
  }

  const content =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""

  if (!content) {
    throw new Error("Gemini OCR returned empty content")
  }

  return { content }
}
