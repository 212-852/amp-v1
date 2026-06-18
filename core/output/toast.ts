import {
  chat_content,
  resolveChatContent,
  type ChatContentKey,
} from "@/core/chat/content"
import type { ChatLocale } from "@/core/chat/types"
import type { Locale } from "@/src/lib/locale"

export type ToastMessageKey =
  | "bot_enabled"
  | "concierge_enabled"
  | "mode_change_failed"

const toast_content_keys: Record<
  ToastMessageKey,
  Extract<ChatContentKey, "bot_mode_enabled" | "concierge_mode_enabled"> | null
> = {
  bot_enabled: "bot_mode_enabled",
  concierge_enabled: "concierge_mode_enabled",
  mode_change_failed: null,
}

const toast_fallback_messages: Record<ToastMessageKey, Record<Locale, string>> =
  {
    bot_enabled: chat_content.bot_mode_enabled,
    concierge_enabled: chat_content.concierge_mode_enabled,
    mode_change_failed: {
      ja: "モード変更に失敗しました",
      en: "Mode change failed",
      es: "No se pudo cambiar el modo",
    },
  }

export type ToastOutput = {
  tone: "success" | "error"
  message: string
  key: ToastMessageKey
}

function toChatLocale(locale: Locale): ChatLocale {
  if (locale === "en" || locale === "es") {
    return locale
  }

  return "ja"
}

export function resolveToastMessage(key: ToastMessageKey, locale: Locale) {
  const content_key = toast_content_keys[key]

  if (content_key) {
    return resolveChatContent(content_key, toChatLocale(locale))
  }

  return toast_fallback_messages[key][locale] ?? toast_fallback_messages[key].ja
}

export function buildModeChangeToast(input: {
  mode: "bot" | "concierge"
  locale: Locale
  failed?: boolean
}): ToastOutput {
  if (input.failed) {
    return {
      tone: "error",
      key: "mode_change_failed",
      message: resolveToastMessage("mode_change_failed", input.locale),
    }
  }

  const key = input.mode === "concierge" ? "concierge_enabled" : "bot_enabled"

  return {
    tone: "success",
    key,
    message: resolveToastMessage(key, input.locale),
  }
}
