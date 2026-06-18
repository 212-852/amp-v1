import type { Locale } from "@/src/lib/locale"

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
  mode_bot_enabled: {
    ja: "Botモードに切り替えました",
    en: "Bot mode enabled.",
    es: "Modo Bot activado",
  },
  mode_concierge_enabled: {
    ja: "コンシェルジュモードに切り替えました",
    en: "Concierge mode enabled.",
    es: "Modo Concierge activado",
  },
  mode_change_failed: {
    ja: "モード変更に失敗しました",
    en: "Mode change failed.",
    es: "No se pudo cambiar el modo",
  },
} satisfies Record<string, Record<Locale, string>>
