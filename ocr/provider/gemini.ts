import "server-only"

import { OCR_FIELD_PROMPTS, OCR_SYSTEM_PROMPT } from "@/ocr/rules"
import type { OcrProviderRequest, OcrProviderResult } from "@/ocr/type"

function split_data_url(value: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(value)
  if (!match) throw new Error("Gemini OCR requires a base64 image")
  return { mime_type: match[1] ?? "image/jpeg", data: match[2] ?? "" }
}

export async function run_gemini_ocr(
  input: OcrProviderRequest,
): Promise<OcrProviderResult> {
  const api_key = process.env.GEMINI_API_KEY?.trim()
  if (!api_key) throw new Error("GEMINI_API_KEY is not configured")

  const image = split_data_url(input.image_data_url)
  const model = process.env.GEMINI_OCR_MODEL ?? "gemini-2.0-flash"
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(api_key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
        contents: [{
          role: "user",
          parts: [
            { text: `${OCR_SYSTEM_PROMPT}\n\n${OCR_FIELD_PROMPTS[input.document_type]}` },
            { inline_data: image },
          ],
        }],
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) throw new Error(`Gemini OCR failed (${response.status})`)

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const content = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("") ?? ""
  const parsed = JSON.parse(content) as Record<string, unknown>

  return {
    fields: (parsed.fields ?? parsed.parsed ?? {}) as Record<string, string>,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((value): value is string => typeof value === "string")
      : [],
  }
}
