import type { ChatLocale } from "@/core/chat/types"

export type BotMessageTrigger = "chat_opened" | "quick_menu_requested"

export type LocaleText = Record<ChatLocale, string>

export type LineFlexCarouselPayload = {
  type: "carousel"
  contents: Record<string, unknown>[]
}

export const BOT_IMAGE = {
  quick_menu: "/images/quick-menu.jpg",
  how_to_use: "/images/how-yo-use.jpg",
  faq: "/images/FAQ.jpg",
} as const

const WELCOME_ALT: LocaleText = {
  ja: "PET TAXIへようこそ",
  en: "Welcome to PET TAXI",
  es: "Bienvenido a PET TAXI",
}

const QUICK_MENU_ALT: LocaleText = {
  ja: "クイックメニュー",
  en: "Quick Menu",
  es: "Menu rapido",
}

const QUICK_MENU_TITLE: LocaleText = {
  ja: "クイックメニュー",
  en: "Quick Menu",
  es: "Menu rapido",
}

const QUICK_MENU_BODY: LocaleText = {
  ja: "ご希望の内容を選んでください。",
  en: "Choose an option below.",
  es: "Elige una opcion.",
}

const WELCOME_BUBBLES: Array<{
  image: string
  title: LocaleText
  body: LocaleText
  buttons: Array<{ label: LocaleText; action: string }>
}> = [
  {
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

const QUICK_MENU_BUTTONS: Array<{ label: LocaleText; action: string }> = [
  {
    label: {
      ja: "空き状況を確認",
      en: "Check availability",
      es: "Ver disponibilidad",
    },
    action: "check_availability",
  },
  {
    label: {
      ja: "予約する",
      en: "Reserve",
      es: "Reservar",
    },
    action: "reserve",
  },
  {
    label: {
      ja: "予約を確認する",
      en: "Check reservation",
      es: "Ver reserva",
    },
    action: "check_reservation",
  },
  {
    label: {
      ja: "待ち合わせ場所を共有",
      en: "Share meeting place",
      es: "Compartir punto de encuentro",
    },
    action: "share_meeting_place",
  },
  {
    label: {
      ja: "予約をキャンセル",
      en: "Cancel reservation",
      es: "Cancelar reserva",
    },
    action: "cancel_reservation",
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

function readRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export function isLineFlexCarouselPayload(
  payload: Record<string, unknown> | null | undefined,
): payload is LineFlexCarouselPayload {
  const record = readRecord(payload)

  return record?.type === "carousel" && Array.isArray(record.contents)
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

function buildHero(image_path: string) {
  return {
    type: "image",
    url: image_path,
    size: "full",
    aspectRatio: "20:13",
    aspectMode: "cover",
  }
}

function buildBody(title: string, body: string) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    paddingAll: "16px",
    contents: [
      {
        type: "text",
        text: title,
        weight: "bold",
        size: "md",
        color: "#3D2A19",
      },
      {
        type: "text",
        text: body,
        wrap: true,
        size: "sm",
        color: "#8C7358",
      },
    ],
  }
}

function buildFooter(buttons: Array<{ label: string; action: string }>) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    paddingAll: "12px",
    contents: buttons.map((button) => ({
      type: "button",
      style: "primary",
      color: "#8F5D28",
      height: "sm",
      action: {
        type: "postback",
        label: button.label,
        data: button.action,
      },
    })),
  }
}

function buildBubble(input: {
  image_path: string
  title: string
  body: string
  buttons: Array<{ label: string; action: string }>
}) {
  return {
    type: "bubble",
    hero: buildHero(input.image_path),
    body: buildBody(input.title, input.body),
    footer: buildFooter(input.buttons),
  }
}

export function buildWelcomeCarousel(locale: ChatLocale): LineFlexCarouselPayload {
  return {
    type: "carousel",
    contents: WELCOME_BUBBLES.map((bubble) =>
      buildBubble({
        image_path: bubble.image,
        title: resolveLocaleText(bubble.title, locale),
        body: resolveLocaleText(bubble.body, locale),
        buttons: bubble.buttons.map((button) => ({
          label: resolveLocaleText(button.label, locale),
          action: button.action,
        })),
      }),
    ),
  }
}

export function buildQuickMenuCarousel(
  locale: ChatLocale,
): LineFlexCarouselPayload {
  return {
    type: "carousel",
    contents: [
      buildBubble({
        image_path: BOT_IMAGE.quick_menu,
        title: resolveLocaleText(QUICK_MENU_TITLE, locale),
        body: resolveLocaleText(QUICK_MENU_BODY, locale),
        buttons: QUICK_MENU_BUTTONS.map((button) => ({
          label: resolveLocaleText(button.label, locale),
          action: button.action,
        })),
      }),
    ],
  }
}

export function buildBotCarouselPayload(input: {
  trigger: BotMessageTrigger
  locale: ChatLocale
}): LineFlexCarouselPayload {
  if (input.trigger === "quick_menu_requested") {
    return buildQuickMenuCarousel(input.locale)
  }

  return buildWelcomeCarousel(input.locale)
}

export function resolveBotMessageBody(trigger: BotMessageTrigger) {
  if (trigger === "quick_menu_requested") {
    return "quick_menu"
  }

  return "welcome"
}

export function resolveBotAltText(
  trigger: BotMessageTrigger,
  locale: ChatLocale,
) {
  if (trigger === "quick_menu_requested") {
    return resolveLocaleText(QUICK_MENU_ALT, locale)
  }

  return resolveLocaleText(WELCOME_ALT, locale)
}

export function carouselPayloadToLineFlex(input: {
  payload: LineFlexCarouselPayload
  alt_text: string
  base_url?: string | null
}) {
  const contents = input.payload.contents.map((bubble) =>
    resolveFlexNodeImages(bubble, input.base_url),
  )

  return {
    type: "flex",
    altText: input.alt_text,
    contents: {
      type: "carousel",
      contents,
    },
  }
}

function resolveFlexNodeImages(
  value: unknown,
  base_url?: string | null,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveFlexNodeImages(item, base_url))
  }

  const record = readRecord(value)

  if (!record) {
    return value
  }

  const next: Record<string, unknown> = {}

  for (const [key, child] of Object.entries(record)) {
    if (key === "url" && typeof child === "string") {
      next[key] = resolvePublicAssetUrl(child, base_url)
      continue
    }

    next[key] = resolveFlexNodeImages(child, base_url)
  }

  return next
}

export function isQuickMenuTriggerAction(action: string) {
  return action === "quick_menu_requested"
}

// Backward-compatible alias used by chat/rules.ts
export function isCarouselPayload(
  payload: Record<string, unknown> | null | undefined,
): payload is LineFlexCarouselPayload {
  return isLineFlexCarouselPayload(payload)
}
