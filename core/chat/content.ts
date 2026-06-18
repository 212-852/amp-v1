import type { ChatLocale } from "@/core/chat/types"

export type ChatContentKey =
  | "welcome_title"
  | "quick_menu_title"
  | "quick_menu_body"
  | "terms"
  | "check_availability"
  | "create_booking"
  | "confirm_booking"
  | "share_meeting_place"
  | "cancel_booking"
  | "meeting_support_title"
  | "meeting_support_body"
  | "bot_mode_enabled"
  | "concierge_mode_enabled"
  | "message_placeholder"
  | "mode_bot"
  | "mode_concierge"

export type LocaleText = Record<ChatLocale, string>

export const chat_content: Record<ChatContentKey, LocaleText> = {
  welcome_title: {
    ja: "PET TAXIへようこそ",
    en: "Welcome to PET TAXI",
    es: "Bienvenido a PET TAXI",
  },
  quick_menu_title: {
    ja: "クイックメニュー",
    en: "Quick Menu",
    es: "Menu rapido",
  },
  quick_menu_body: {
    ja: "ご希望の内容を選んでください。",
    en: "Choose an option below.",
    es: "Elige una opcion.",
  },
  terms: {
    ja: "ご利用規約",
    en: "Terms of use",
    es: "Terminos de uso",
  },
  check_availability: {
    ja: "空き状況を確認",
    en: "Check availability",
    es: "Ver disponibilidad",
  },
  create_booking: {
    ja: "予約する",
    en: "Reserve",
    es: "Reservar",
  },
  confirm_booking: {
    ja: "予約を確認する",
    en: "Check reservation",
    es: "Ver reserva",
  },
  share_meeting_place: {
    ja: "待ち合わせ場所を共有",
    en: "Share meeting place",
    es: "Compartir punto de encuentro",
  },
  cancel_booking: {
    ja: "予約をキャンセル",
    en: "Cancel reservation",
    es: "Cancelar reserva",
  },
  meeting_support_title: {
    ja: "待ち合わせサポート",
    en: "Meetup support",
    es: "Soporte de encuentro",
  },
  meeting_support_body: {
    ja: "当日は診察終了や空港手続き完了のタイミングに合わせ、ドライバーがお客様とペットが確実に合流できるようサポートいたします。",
    en: "On the day, we align with clinic finish or airport procedures so the driver can meet you and your pet reliably.",
    es: "El dia del servicio, nos coordinamos con el fin de la consulta o los tramites del aeropuerto para que el conductor se encuentre contigo y tu mascota sin problemas.",
  },
  bot_mode_enabled: {
    ja: "ボットモードに切り替えました",
    en: "Bot mode enabled.",
    es: "Modo bot activado.",
  },
  concierge_mode_enabled: {
    ja: "コンシェルジュモードに切り替えました",
    en: "Concierge mode enabled.",
    es: "Modo conserje activado.",
  },
  message_placeholder: {
    ja: "メッセージを入力",
    en: "Type a message",
    es: "Escribe un mensaje",
  },
  mode_bot: {
    ja: "Bot",
    en: "Bot",
    es: "Bot",
  },
  mode_concierge: {
    ja: "コンシェルジュ",
    en: "Concierge",
    es: "Conserje",
  },
}

export function resolveChatContent(key: ChatContentKey, locale: ChatLocale) {
  return chat_content[key][locale] ?? chat_content[key].ja
}

export function resolveChatContentRecord(key: ChatContentKey): LocaleText {
  return chat_content[key]
}
