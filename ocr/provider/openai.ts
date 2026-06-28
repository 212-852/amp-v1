import "server-only"

import { OCR_FIELD_PROMPTS, OCR_SYSTEM_PROMPT } from "@/ocr/rules"
import type { OcrProviderRequest, OcrProviderResult } from "@/ocr/type"

export async function run_openai_ocr(
  input: OcrProviderRequest,
): Promise<OcrProviderResult> {
  const api_key = process.env.OPENAI_API_KEY?.trim()

  if (!api_key) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: OCR_FIELD_PROMPTS[input.document_type] },
            {
              type: "image_url",
              image_url: { url: input.image_data_url, detail: "high" },
            },
          ],
        },
      ],
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`OpenAI OCR failed (${response.status})`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const content = payload.choices?.[0]?.message?.content ?? ""
  const parsed = JSON.parse(content) as Record<string, unknown>

  return {
    fields: (parsed.fields ?? parsed.parsed ?? {}) as Record<string, string>,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    warnings: Array.isArray(parsed.warnings)
      ? parsed.warnings.filter((value): value is string => typeof value === "string")
      : [],
  }
}
