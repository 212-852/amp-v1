import type { ChatLocale } from "@/core/chat/types"

export type BotMessageTrigger = "chat_opened" | "quick_menu_requested"

export type LocaleText = Record<ChatLocale, string>

export type BotCarouselCardDefinition = {
  key: string
  image: string
  title: LocaleText
  body: LocaleText
  buttons: Array<{
    label: LocaleText
    action: string
  }>
}

export type BotCarouselPayload = {
  kind: "carousel"
  bot_trigger: BotMessageTrigger
  cards: BotCarouselCardDefinition[]
}

export type BotCarouselCardView = {
  key: string
  image_url: string
  title: string
  body: string
  buttons: Array<{
    label: string
    action: string
  }>
}

export const BOT_IMAGE = {
  quick_menu: "/images/quick-menu.jpg",
  how_to_use: "/images/how-yo-use.jpg",
  faq: "/images/FAQ.jpg",
  bot_mode: "/images/bot-mode.jpg",
  concierge_mode: "/images/concierge-mode.jpg",
  reserve: "/images/recruit.jpg",
} as const

const WELCOME_BODY: LocaleText = {
  ja: "PET TAXIへようこそ。まずはこちらからご確認ください。",
  en: "Welcome to PET TAXI. Start here.",
  es: "Bienvenido a PET TAXI. Empieza aqui.",
}

const QUICK_MENU_BODY: LocaleText = {
  ja: "クイックメニューからご希望の内容を選んでください。",
  en: "Choose an option from the quick menu.",
  es: "Elige una opcion del menu rapido.",
}

export const WELCOME_CARDS: BotCarouselCardDefinition[] = [
  {
    key: "quick_menu",
    image: BOT_IMAGE.quick_menu,
    title: {
      ja: "クイックメニュー",
      en: "Quick Menu",
      es: "Menu rapido",
    },
    body: {
      ja: "予約や確認を素早く選べます。",
      en: "Choose booking and support options quickly.",
      es: "Elige reservas y soporte rapidamente.",
    },
    buttons: [
      {
        label: { ja: "開く", en: "Open", es: "Abrir" },
        action: "quick_menu_requested",
      },
    ],
  },
  {
    key: "how_to_use",
    image: BOT_IMAGE.how_to_use,
    title: {
      ja: "使い方",
      en: "How to use",
      es: "Como usar",
    },
    body: {
      ja: "チャットで予約相談や確認ができます。",
      en: "Book, ask, and confirm through chat.",
      es: "Reserva, consulta y confirma por chat.",
    },
    buttons: [
      {
        label: { ja: "詳しく見る", en: "Learn more", es: "Ver mas" },
        action: "how_to_use",
      },
    ],
  },
  {
    key: "faq",
    image: BOT_IMAGE.faq,
    title: {
      ja: "FAQ",
      en: "FAQ",
      es: "FAQ",
    },
    body: {
      ja: "料金や予約方法などを確認できます。",
      en: "Check pricing, areas, and booking steps.",
      es: "Consulta precios, zonas y reservas.",
    },
    buttons: [
      {
        label: { ja: "見る", en: "View", es: "Ver" },
        action: "faq",
      },
    ],
  },
]

export const QUICK_MENU_CARDS: BotCarouselCardDefinition[] = [
  {
    key: "check_availability",
    image: BOT_IMAGE.quick_menu,
    title: {
      ja: "空き状況を確認",
      en: "Check availability",
      es: "Ver disponibilidad",
    },
    body: {
      ja: "希望日時の空き状況を確認できます。",
      en: "Check availability for your preferred date and time.",
      es: "Consulta disponibilidad para tu fecha y hora.",
    },
    buttons: [
      {
        label: { ja: "確認する", en: "Check", es: "Consultar" },
        action: "check_availability",
      },
    ],
  },
  {
    key: "reserve",
    image: BOT_IMAGE.reserve,
    title: {
      ja: "予約する",
      en: "Reserve",
      es: "Reservar",
    },
    body: {
      ja: "送迎の予約を進められます。",
      en: "Start a new ride reservation.",
      es: "Inicia una nueva reserva.",
    },
    buttons: [
      {
        label: { ja: "予約する", en: "Reserve", es: "Reservar" },
        action: "reserve",
      },
    ],
  },
  {
    key: "check_reservation",
    image: BOT_IMAGE.how_to_use,
    title: {
      ja: "予約を確認する",
      en: "Check reservation",
      es: "Ver reserva",
    },
    body: {
      ja: "現在の予約内容を確認できます。",
      en: "Review your current reservation details.",
      es: "Revisa los detalles de tu reserva.",
    },
    buttons: [
      {
        label: { ja: "確認する", en: "Check", es: "Ver" },
        action: "check_reservation",
      },
    ],
  },
  {
    key: "share_meeting_place",
    image: BOT_IMAGE.faq,
    title: {
      ja: "待ち合わせ場所を共有",
      en: "Share meeting place",
      es: "Compartir punto de encuentro",
    },
    body: {
      ja: "待ち合わせ場所を共有できます。",
      en: "Share your meeting location.",
      es: "Comparte tu punto de encuentro.",
    },
    buttons: [
      {
        label: { ja: "共有する", en: "Share", es: "Compartir" },
        action: "share_meeting_place",
      },
    ],
  },
  {
    key: "cancel_reservation",
    image: BOT_IMAGE.bot_mode,
    title: {
      ja: "予約をキャンセル",
      en: "Cancel reservation",
      es: "Cancelar reserva",
    },
    body: {
      ja: "予約のキャンセルを依頼できます。",
      en: "Request to cancel your reservation.",
      es: "Solicita cancelar tu reserva.",
    },
    buttons: [
      {
        label: { ja: "キャンセル", en: "Cancel", es: "Cancelar" },
        action: "cancel_reservation",
      },
    ],
  },
]

export function resolveBotLocale(locale: string | null | undefined): ChatLocale {
  if (locale === "en" || locale === "es") {
    return locale
  }

  return "ja"
}

export function resolveLocaleText(text: LocaleText, locale: ChatLocale) {
  return text[locale] ?? text.ja
}

export function buildCarouselPayload(input: {
  trigger: BotMessageTrigger
  cards: BotCarouselCardDefinition[]
}): BotCarouselPayload {
  return {
    kind: "carousel",
    bot_trigger: input.trigger,
    cards: input.cards,
  }
}

function readRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export function isCarouselPayload(
  payload: Record<string, unknown> | null | undefined,
): payload is BotCarouselPayload {
  return readRecord(payload)?.kind === "carousel"
}

export function resolveCarouselCardsForLocale(
  payload: BotCarouselPayload | Record<string, unknown> | null | undefined,
  locale: ChatLocale,
): BotCarouselCardView[] {
  if (!isCarouselPayload(payload)) {
    return []
  }

  return payload.cards.map((card) => ({
    key: card.key,
    image_url: card.image,
    title: resolveLocaleText(card.title, locale),
    body: resolveLocaleText(card.body, locale),
    buttons: card.buttons.map((button) => ({
      label: resolveLocaleText(button.label, locale),
      action: button.action,
    })),
  }))
}

export function resolvePublicAssetUrl(path: string, base_url?: string | null) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  const base =
    base_url?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")

  if (!base) {
    return path.startsWith("/") ? path : `/${path}`
  }

  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

function buildLineBubble(card: BotCarouselCardView, base_url?: string | null) {
  return {
    type: "bubble",
    hero: {
      type: "image",
      url: resolvePublicAssetUrl(card.image_url, base_url),
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: card.title,
          weight: "bold",
          size: "md",
          color: "#3d2a19",
        },
        {
          type: "text",
          text: card.body,
          wrap: true,
          size: "sm",
          color: "#8c7358",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "12px",
      contents: card.buttons.map((button) => ({
        type: "button",
        style: "primary",
        color: "#8f5d28",
        height: "sm",
        action: {
          type: "postback",
          label: button.label,
          data: button.action,
        },
      })),
    },
  }
}

export function carouselPayloadToLineFlex(input: {
  payload: BotCarouselPayload | Record<string, unknown>
  locale: ChatLocale
  alt_text: string
  base_url?: string | null
}) {
  const cards = resolveCarouselCardsForLocale(input.payload, input.locale)

  return {
    type: "flex",
    altText: input.alt_text,
    contents: {
      type: "carousel",
      contents: cards.map((card) => buildLineBubble(card, input.base_url)),
    },
  }
}

export function resolveBotMessageBody(
  trigger: BotMessageTrigger,
  locale: ChatLocale,
) {
  if (trigger === "quick_menu_requested") {
    return resolveLocaleText(QUICK_MENU_BODY, locale)
  }

  return resolveLocaleText(WELCOME_BODY, locale)
}

export function resolveBotCarouselCards(trigger: BotMessageTrigger) {
  if (trigger === "quick_menu_requested") {
    return QUICK_MENU_CARDS
  }

  return WELCOME_CARDS
}

export function isQuickMenuTriggerAction(action: string) {
  return action === "quick_menu_requested"
}
