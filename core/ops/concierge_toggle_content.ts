import type { Locale } from "@/src/lib/locale"

export const concierge_toggle_content = {
  on_success: {
    ja: "コンシェルジュ対応をONにしました",
    en: "Concierge is now ON",
    es: "Concierge activado",
  },
  off_success: {
    ja: "コンシェルジュ対応をOFFにしました",
    en: "Concierge is now OFF",
    es: "Concierge desactivado",
  },
  error: {
    ja: "切り替えに失敗しました",
    en: "Failed to update concierge status",
    es: "No se pudo actualizar el estado",
  },
} satisfies Record<string, Record<Locale, string>>
