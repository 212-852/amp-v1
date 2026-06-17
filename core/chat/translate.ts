import type { ChatLocale, ChatTranslations } from "@/core/chat/types"

export async function translateMessageText(input: {
  text: string
  source_locale: ChatLocale
  target_locale: ChatLocale
  existing_translations: ChatTranslations
}): Promise<{
  translations: ChatTranslations
  translation_status: "none" | "complete" | "failed"
}> {
  if (input.source_locale === input.target_locale) {
    return {
      translations: input.existing_translations,
      translation_status: "none",
    }
  }

  if (input.existing_translations[input.target_locale]) {
    return {
      translations: input.existing_translations,
      translation_status: "complete",
    }
  }

  const api_key = process.env.OPENAI_API_KEY?.trim()

  if (!api_key) {
    return {
      translations: input.existing_translations,
      translation_status: "failed",
    }
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Translate the user message accurately. Return only the translated text with no quotes or commentary.",
          },
          {
            role: "user",
            content: `Source locale: ${input.source_locale}\nTarget locale: ${input.target_locale}\nText: ${input.text}`,
          },
        ],
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      return {
        translations: input.existing_translations,
        translation_status: "failed",
      }
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const translated = payload.choices?.[0]?.message?.content?.trim()

    if (!translated) {
      return {
        translations: input.existing_translations,
        translation_status: "failed",
      }
    }

    return {
      translations: {
        ...input.existing_translations,
        [input.target_locale]: translated,
      },
      translation_status: "complete",
    }
  } catch {
    return {
      translations: input.existing_translations,
      translation_status: "failed",
    }
  }
}

export async function ensureRoomLocaleTranslation(input: {
  body_original: string
  original_locale: ChatLocale
  room_locale: ChatLocale
  existing_translations: ChatTranslations
}) {
  const result = await translateMessageText({
    text: input.body_original,
    source_locale: input.original_locale,
    target_locale: input.room_locale,
    existing_translations: input.existing_translations,
  })

  const body_display =
    result.translations[input.room_locale] ?? input.body_original

  return {
    body_display,
    display_locale:
      result.translations[input.room_locale] != null
        ? input.room_locale
        : input.original_locale,
    translations: result.translations,
    translation_status: result.translation_status,
  }
}
