import type { Locale } from "@/src/lib/locale"

import {
  buildModeChangeToast,
  resolveToastMessage,
  toast_messages,
  type ToastMessageKey,
  type ToastOutput,
} from "@/core/output/toast"

export const chat_mode_toast_content = {
  mode_bot_label: {
    ja: "Bot",
    en: "Bot",
    es: "Bot",
  },
  mode_concierge_label: {
    ja: "コンシェルジュ",
    en: "Concierge",
    es: "Conserje",
  },
  mode_bot_enabled: toast_messages.bot_enabled,
  mode_concierge_enabled: toast_messages.concierge_enabled,
  mode_change_failed: toast_messages.mode_change_failed,
} satisfies Record<string, Record<Locale, string>>

export {
  buildModeChangeToast,
  resolveToastMessage,
  toast_messages,
  type ToastMessageKey,
  type ToastOutput,
}
