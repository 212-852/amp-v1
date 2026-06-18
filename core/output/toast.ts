import type { Locale } from "@/src/lib/locale"

export type ToastMessageKey =
  | "bot_enabled"
  | "concierge_enabled"
  | "mode_change_failed"

export const toast_messages: Record<
  ToastMessageKey,
  Record<Locale, string>
> = {
  bot_enabled: {
    ja: "ボットモードに切り替えました",
    en: "Bot mode enabled",
    es: "Modo bot activado",
  },
  concierge_enabled: {
    ja: "コンシェルジュモードに切り替えました",
    en: "Concierge mode enabled",
    es: "Modo conserje activado",
  },
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

export function resolveToastMessage(key: ToastMessageKey, locale: Locale) {
  return toast_messages[key][locale] ?? toast_messages[key].ja
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
