import { request_openai_chat_completion } from "@/core/ocr/openai"
import { request_gemini_ocr } from "@/core/ocr/gemini"
import {
  is_provider_result_unreadable,
  normalize_provider_parse_result,
  OCR_FIELD_PROMPTS,
  OCR_SYSTEM_PROMPT,
} from "@/core/ocr/provider_shared"
import {
  read_fallback_provider,
  read_primary_provider,
  read_provider_api_key,
  type OcrProviderName,
} from "@/core/ocr/providers"
import { send_ocr_server_debug } from "@/core/ocr/server_debug"
import type { OcrDocumentType, OcrParseResult } from "@/core/ocr/rules"

async function analyze_with_openai(input: {
  document_type: OcrDocumentType
  image_url: string
}): Promise<OcrParseResult> {
  const payload = await request_openai_chat_completion({
    document_type: input.document_type,
    body: {
      model: process.env.OPENAI_OCR_MODEL ?? "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: OCR_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: OCR_FIELD_PROMPTS[input.document_type],
            },
            {
              type: "image_url",
              image_url: { url: input.image_url, detail: "high" },
            },
          ],
        },
      ],
    },
  })

  const content = payload.choices?.[0]?.message?.content?.trim() ?? ""

  return normalize_provider_parse_result(content)
}

async function analyze_with_gemini(input: {
  document_type: OcrDocumentType
  image_url: string
}): Promise<OcrParseResult> {
  const response = await request_gemini_ocr({
    document_type: input.document_type,
    image_url: input.image_url,
    prompt: `${OCR_SYSTEM_PROMPT}\n\n${OCR_FIELD_PROMPTS[input.document_type]}`,
  })

  return normalize_provider_parse_result(response.content)
}

async function analyze_with_provider(input: {
  provider: OcrProviderName
  document_type: OcrDocumentType
  image_url: string
}): Promise<OcrParseResult> {
  if (!read_provider_api_key(input.provider)) {
    throw new Error(
      input.provider === "openai"
        ? "OPENAI_API_KEY is not configured"
        : "GEMINI_API_KEY is not configured",
    )
  }

  if (input.provider === "gemini") {
    return analyze_with_gemini(input)
  }

  return analyze_with_openai(input)
}

export async function parse_document(input: {
  document_type: OcrDocumentType
  image_url: string
}): Promise<OcrParseResult & { provider: OcrProviderName }> {
  const primary_provider = read_primary_provider()
  const fallback_provider = read_fallback_provider()

  await send_ocr_server_debug("OCR_PROVIDER_PRIMARY_STARTED", {
    document_type: input.document_type,
    provider: primary_provider,
  })

  let should_use_fallback = false

  try {
    const primary_result = await analyze_with_provider({
      provider: primary_provider,
      document_type: input.document_type,
      image_url: input.image_url,
    })

    if (
      is_provider_result_unreadable({
        document_type: input.document_type,
        result: primary_result,
      })
    ) {
      await send_ocr_server_debug("OCR_PROVIDER_PRIMARY_UNREADABLE", {
        document_type: input.document_type,
        provider: primary_provider,
        confidence: primary_result.confidence,
        warnings: primary_result.warnings,
      })
      should_use_fallback = true
    } else {
      await send_ocr_server_debug("OCR_PROVIDER_PRIMARY_SUCCESS", {
        document_type: input.document_type,
        provider: primary_provider,
        confidence: primary_result.confidence,
        warning_count: primary_result.warnings.length,
      })

      return {
        ...primary_result,
        provider: primary_provider,
      }
    }
  } catch (error) {
    await send_ocr_server_debug("OCR_PROVIDER_PRIMARY_FAILED", {
      document_type: input.document_type,
      provider: primary_provider,
      message: error instanceof Error ? error.message : "primary_provider_failed",
    })
    should_use_fallback = true
  }

  if (!should_use_fallback) {
    throw new Error("Primary OCR provider did not return a readable result")
  }

  if (!fallback_provider || fallback_provider === primary_provider) {
    throw new Error("OCR fallback provider is not configured")
  }

  await send_ocr_server_debug("OCR_PROVIDER_FALLBACK_STARTED", {
    document_type: input.document_type,
    provider: fallback_provider,
  })

  try {
    const fallback_result = await analyze_with_provider({
      provider: fallback_provider,
      document_type: input.document_type,
      image_url: input.image_url,
    })

    if (
      is_provider_result_unreadable({
        document_type: input.document_type,
        result: fallback_result,
      })
    ) {
      await send_ocr_server_debug("OCR_PROVIDER_FALLBACK_FAILED", {
        document_type: input.document_type,
        provider: fallback_provider,
        reason: "unreadable",
        confidence: fallback_result.confidence,
        warnings: fallback_result.warnings,
      })

      throw new Error("Fallback OCR provider returned unreadable result")
    }

    await send_ocr_server_debug("OCR_PROVIDER_FALLBACK_SUCCESS", {
      document_type: input.document_type,
      provider: fallback_provider,
      confidence: fallback_result.confidence,
      warning_count: fallback_result.warnings.length,
    })

    return {
      ...fallback_result,
      provider: fallback_provider,
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== "Fallback OCR provider returned unreadable result"
    ) {
      await send_ocr_server_debug("OCR_PROVIDER_FALLBACK_FAILED", {
        document_type: input.document_type,
        provider: fallback_provider,
        message: error instanceof Error ? error.message : "fallback_provider_failed",
      })
    }

    throw error
  }
}
