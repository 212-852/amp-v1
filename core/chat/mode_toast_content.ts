import {
  chat_content,
  resolveChatContent,
  type ChatContentKey,
} from "@/core/chat/content"
import type { Locale } from "@/src/lib/locale"

export const chat_mode_toast_content = {
  mode_bot_label: chat_content.mode_bot,
  mode_concierge_label: chat_content.mode_concierge,
  mode_bot_enabled: chat_content.bot_mode_enabled,
  mode_concierge_enabled: chat_content.concierge_mode_enabled,
  mode_change_failed: {
    ja: "モード変更に失敗しました",
    en: "Mode change failed",
    es: "No se pudo cambiar el modo",
  },
} satisfies Record<string, Record<Locale, string>>

export {
  chat_content,
  resolveChatContent,
  type ChatContentKey,
}

export {
  buildModeChangeToast,
  resolveToastMessage,
  type ToastMessageKey,
  type ToastOutput,
} from "@/core/output/toast"
