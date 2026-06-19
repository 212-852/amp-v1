import type { Locale } from "@/src/lib/locale"

export const concierge_queue_content = {
  title: {
    ja: "コンシェルジュ対応",
    en: "Concierge queue",
    es: "Cola de concierge",
  },
  concierge_tab: {
    ja: "Concierge",
    en: "Concierge",
    es: "Concierge",
  },
  bot_tab: {
    ja: "Bot",
    en: "Bot",
    es: "Bot",
  },
  unassigned: {
    ja: "未対応",
    en: "Unassigned",
    es: "Sin asignar",
  },
  typing: {
    ja: "入力中...",
    en: "Typing...",
    es: "Escribiendo...",
  },
  view_all: {
    ja: "一覧へ →",
    en: "View all →",
    es: "Ver todo →",
  },
  empty: {
    ja: "対応が必要なルームはありません",
    en: "No rooms need concierge action",
    es: "No hay salas que requieran concierge",
  },
  loading: {
    ja: "ルームを読み込み中...",
    en: "Loading rooms...",
    es: "Cargando salas...",
  },
  off: {
    ja: "コンシェルジュ受付はOFFです",
    en: "Concierge availability is OFF",
    es: "La disponibilidad de concierge esta desactivada",
  },
} satisfies Record<string, Record<Locale, string>>
