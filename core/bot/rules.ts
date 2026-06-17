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

const TERMS_OF_USE: LocaleText = {
  ja: "ご利用規約",
  en: "Terms of use",
  es: "Terminos de uso",
}

const MEETUP_SUPPORT_TITLE: LocaleText = {
  ja: "待ち合わせサポート",
  en: "Meetup support",
  es: "Soporte de encuentro",
}

const MEETUP_SUPPORT_BODY: LocaleText = {
  ja: "当日は診察終了や空港手続き完了のタイミングに合わせ、ドライバーがお客様とペットが確実に合流できるようサポートいたします。",
  en: "On the day, we align with clinic finish or airport procedures so the driver can meet you and your pet reliably.",
  es: "El dia del servicio, nos coordinamos con el fin de la consulta o los tramites del aeropuerto para que el conductor se encuentre contigo y tu mascota sin problemas.",
}

const SHARE_MEETUP_LINK: LocaleText = {
  ja: "待ち合わせ場所を共有する",
  en: "Share meetup location",
  es: "Compartir punto de encuentro",
}

const CANCEL_RESERVATION_LINK: LocaleText = {
  ja: "予約をキャンセルする",
  en: "Cancel reservation",
  es: "Cancelar reserva",
}

const WELCOME_QUICK_MENU_BUTTONS: Array<{ label: LocaleText; action: string }> = [
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
      en: "Request a ride",
      es: "Reservar",
    },
    action: "reserve",
  },
  {
    label: {
      ja: "予約を確認する",
      en: "Review reservation",
      es: "Ver reserva",
    },
    action: "check_reservation",
  },
  {
    label: {
      ja: "待ち合わせ場所を共有",
      en: "Share meetup location",
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

const WELCOME_BUBBLES: Array<{
  image: string
  title: LocaleText
  body: LocaleText
  buttons: Array<{ label: LocaleText; action: string }>
}> = [
  {
    image: BOT_IMAGE.how_to_use,
    title: {
      ja: "ご利用方法",
      en: "How to use",
      es: "Como usar",
    },
    body: {
      ja: "予約までの流れを確認できます。",
      en: "See how to complete a booking.",
      es: "Consulta el flujo de reserva.",
    },
    buttons: [
      {
        label: {
          ja: "ご利用方法を見る",
          en: "View how to use",
          es: "Ver como usar",
        },
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
      ja: "よくある質問を確認できます。",
      en: "Check frequently asked questions.",
      es: "Consulta preguntas frecuentes.",
    },
    buttons: [
      {
        label: { ja: "FAQを見る", en: "View FAQ", es: "Ver FAQ" },
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

function buildQuickMenuBody(locale: ChatLocale) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "sm",
    paddingAll: "16px",
    contents: [
      {
        type: "text",
        text: resolveLocaleText(QUICK_MENU_TITLE, locale),
        weight: "bold",
        size: "md",
        color: "#3D2A19",
      },
      {
        type: "text",
        text: resolveLocaleText(TERMS_OF_USE, locale),
        wrap: true,
        size: "xs",
        color: "#8C7358",
      },
      {
        type: "separator",
      },
      {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        paddingAll: "0",
        contents: [
          {
            type: "text",
            text: resolveLocaleText(MEETUP_SUPPORT_TITLE, locale),
            weight: "bold",
            size: "sm",
            color: "#3D2A19",
          },
          {
            type: "text",
            text: resolveLocaleText(MEETUP_SUPPORT_BODY, locale),
            wrap: true,
            size: "sm",
            color: "#8C7358",
          },
        ],
      },
    ],
  }
}

function buildWelcomeFlexButton(label: string, action: string) {
  return {
    type: "button",
    style: "primary",
    color: "#8F5D28",
    height: "sm",
    cornerRadius: "16px",
    action: {
      type: "postback",
      label,
      data: action,
    },
  }
}

function buildWelcomeFlexLink(label: string, action: string) {
  return {
    type: "button",
    style: "link",
    color: "#8F5D28",
    action: {
      type: "postback",
      label,
      data: action,
    },
  }
}

function buildWelcomeQuickMenuBubble(locale: ChatLocale) {
  return {
    type: "bubble",
    hero: buildHero(BOT_IMAGE.quick_menu),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: resolveLocaleText(QUICK_MENU_TITLE, locale),
          weight: "bold",
          size: "md",
          color: "#3D2A19",
        },
        {
          type: "text",
          text: resolveLocaleText(TERMS_OF_USE, locale),
          wrap: true,
          size: "xs",
          color: "#8C7358",
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "12px",
      contents: [
        ...WELCOME_QUICK_MENU_BUTTONS.map((button) =>
          buildWelcomeFlexButton(
            resolveLocaleText(button.label, locale),
            button.action,
          ),
        ),
        { type: "separator" },
        {
          type: "text",
          text: resolveLocaleText(MEETUP_SUPPORT_TITLE, locale),
          weight: "bold",
          size: "sm",
          color: "#3D2A19",
        },
        {
          type: "text",
          text: resolveLocaleText(MEETUP_SUPPORT_BODY, locale),
          wrap: true,
          size: "sm",
          color: "#8C7358",
        },
        buildWelcomeFlexLink(
          resolveLocaleText(SHARE_MEETUP_LINK, locale),
          "share_meeting_place",
        ),
        buildWelcomeFlexLink(
          resolveLocaleText(CANCEL_RESERVATION_LINK, locale),
          "cancel_reservation",
        ),
      ],
    },
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
  body_node?: Record<string, unknown>
}) {
  return {
    type: "bubble",
    hero: buildHero(input.image_path),
    body: input.body_node ?? buildBody(input.title, input.body),
    footer: buildFooter(input.buttons),
  }
}

export function buildWelcomeCarousel(locale: ChatLocale): LineFlexCarouselPayload {
  const other_bubbles = WELCOME_BUBBLES.map((bubble) =>
    buildBubble({
      image_path: bubble.image,
      title: resolveLocaleText(bubble.title, locale),
      body: resolveLocaleText(bubble.body, locale),
      buttons: bubble.buttons.map((button) => ({
        label: resolveLocaleText(button.label, locale),
        action: button.action,
      })),
    }),
  )

  return {
    type: "carousel",
    contents: [buildWelcomeQuickMenuBubble(locale), ...other_bubbles],
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
        body_node: buildQuickMenuBody(locale),
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
