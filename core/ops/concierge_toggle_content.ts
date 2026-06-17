import type { Locale } from "@/src/lib/locale"

export const concierge_toggle_content = {
  on_success: {
    ja: "コンシェルジュ対応を開始しました",
    en: "Concierge support started",
    es: "Se inicio el soporte de concierge",
  },
  off_success: {
    ja: "コンシェルジュ対応を停止しました",
    en: "Concierge support stopped",
    es: "Se detuvo el soporte de concierge",
  },
  error: {
    ja: "切り替えに失敗しました",
    en: "Failed to update concierge status",
    es: "No se pudo actualizar el estado",
  },
} satisfies Record<string, Record<Locale, string>>
