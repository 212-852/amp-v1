import type { ChatLocale } from "@/core/chat/types"
import {
  resolveChatContent,
  resolveChatContentRecord,
  type LocaleText,
} from "@/core/chat/content"

export type BotMessageTrigger = "chat_opened" | "quick_menu_requested"

export type LineFlexCarouselPayload = {
  type: "carousel"
  contents: Record<string, unknown>[]
}

export const BOT_IMAGE = {
  quick_menu: "/images/quick-menu.jpg",
  how_to_use: "/images/how-to-use.jpg",
  faq: "/images/FAQ.jpg",
} as const

const WELCOME_ALT = resolveChatContentRecord("welcome_title")
const QUICK_MENU_ALT = resolveChatContentRecord("quick_menu_title")
const QUICK_MENU_TITLE = resolveChatContentRecord("quick_menu_title")
const QUICK_MENU_BODY = resolveChatContentRecord("quick_menu_body")
const TERMS_OF_USE = resolveChatContentRecord("terms")
const MEETUP_SUPPORT_TITLE = resolveChatContentRecord("meeting_support_title")
const MEETUP_SUPPORT_BODY = resolveChatContentRecord("meeting_support_body")

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

export type { LocaleText } from "@/core/chat/content"

const WELCOME_QUICK_MENU_BUTTONS: Array<{ label: LocaleText; action: string }> = [
  {
    label: resolveChatContentRecord("check_availability"),
    action: "check_availability",
  },
  {
    label: resolveChatContentRecord("create_booking"),
    action: "reserve",
  },
  {
    label: resolveChatContentRecord("confirm_booking"),
    action: "check_reservation",
  },
  {
    label: resolveChatContentRecord("share_meeting_place"),
    action: "share_meeting_place",
  },
  {
    label: resolveChatContentRecord("cancel_booking"),
    action: "cancel_reservation",
  },
]

const HOW_TO_USE_TITLE: LocaleText = {
  ja: "ご利用方法",
  en: "How to use",
  es: "Como usar",
}

const HOW_TO_USE_BODY: LocaleText = {
  ja: [
    "1. 空き状況を確認します。",
    "2. 予約内容を入力します。",
    "3. 内容を確認して送信します。",
    "4. 当日の合流場所を共有できます。",
  ].join("\n"),
  en: [
    '1) Tap "Check availability"',
    '2) If available, tap "Request a ride"',
    "3) Enter pickup, drop-off, time, and pet details",
    "4) Review and send",
  ].join("\n"),
  es: [
    "1) Consulta disponibilidad",
    "2) Si hay disponibilidad, solicita el traslado",
    "3) Ingresa origen, destino, hora y detalles de la mascota",
    "4) Revisa y envia",
  ].join("\n"),
}

const HOW_TO_USE_NOTE_TITLE: LocaleText = {
  ja: "ご注意",
  en: "Notes",
  es: "Notas",
}

const HOW_TO_USE_NOTE_BODY: LocaleText = {
  ja: "料金は時間帯、エリア、道路状況により変わります。夜間や緊急のご依頼は対応できない場合があります。キャンセル料が発生する場合があります。",
  en: "Fares vary by time, area, and traffic. Night and urgent requests may be limited. Cancellation fees may apply.",
  es: "Las tarifas varian por hora, area y trafico. Los servicios nocturnos o urgentes pueden ser limitados. Pueden aplicarse cargos por cancelacion.",
}

const HOW_TO_USE_LINK: LocaleText = {
  ja: "ご利用方法をもっと見る",
  en: "See more how to use",
  es: "Ver mas sobre como usar",
}

const FAQ_TITLE: LocaleText = {
  ja: "FAQ",
  en: "FAQ",
  es: "FAQ",
}

const FAQ_BODY_LINES: LocaleText = {
  ja: ["お支払い方法", "料金の仕組み", "ケージとサイズ制限"].join("\n"),
  en: ["Payment methods", "How pricing works", "Carrier and size limits"].join(
    "\n",
  ),
  es: ["Metodos de pago", "Como funcionan los precios", "Transportin y limites de tamano"].join(
    "\n",
  ),
}

const FAQ_BUTTONS: Array<{ label: LocaleText; action: string }> = [
  {
    label: {
      ja: "お支払い方法",
      en: "Payment methods",
      es: "Metodos de pago",
    },
    action: "faq_payment_methods",
  },
  {
    label: {
      ja: "料金の仕組み",
      en: "How pricing works",
      es: "Como funcionan los precios",
    },
    action: "faq_pricing",
  },
  {
    label: {
      ja: "ケージとサイズ制限",
      en: "Carrier and size limits",
      es: "Transportin y limites de tamano",
    },
    action: "faq_carrier_size",
  },
  {
    label: {
      ja: "FAQをすべて見る",
      en: "Open all FAQs",
      es: "Abrir todas las FAQ",
    },
    action: "faq",
  },
]

const QUICK_MENU_BUTTONS: Array<{ label: LocaleText; action: string }> = [
  {
    label: resolveChatContentRecord("check_availability"),
    action: "check_availability",
  },
  {
    label: resolveChatContentRecord("create_booking"),
    action: "reserve",
  },
  {
    label: resolveChatContentRecord("confirm_booking"),
    action: "check_reservation",
  },
  {
    label: resolveChatContentRecord("share_meeting_place"),
    action: "share_meeting_place",
  },
  {
    label: resolveChatContentRecord("cancel_booking"),
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

function buildWelcomeBodyBox(input: {
  title: string
  body?: string
  subtitle?: string
}) {
  const contents: Record<string, unknown>[] = [
    {
      type: "text",
      text: input.title,
      weight: "bold",
      size: "md",
      color: "#3D2A19",
    },
  ]

  if (input.subtitle) {
    contents.push({
      type: "text",
      text: input.subtitle,
      wrap: true,
      size: "xs",
      color: "#8C7358",
    })
  }

  if (input.body) {
    contents.push({
      type: "text",
      text: input.body,
      wrap: true,
      size: "sm",
      color: "#8C7358",
    })
  }

  return {
    type: "box",
    layout: "vertical",
    spacing: "md",
    paddingAll: "20px",
    contents,
  }
}

function buildWelcomePrimaryFooter(
  buttons: Array<{ label: string; action: string }>,
) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "md",
    paddingAll: "18px",
    contents: buttons.map((button) =>
      buildWelcomeFlexButton(button.label, button.action),
    ),
  }
}

function buildHowToUseBody(locale: ChatLocale) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "md",
    paddingAll: "20px",
    contents: [
      {
        type: "text",
        text: resolveLocaleText(HOW_TO_USE_TITLE, locale),
        weight: "bold",
        size: "md",
        color: "#3D2A19",
      },
      {
        type: "text",
        text: resolveLocaleText(HOW_TO_USE_BODY, locale),
        wrap: true,
        size: "sm",
        color: "#8C7358",
      },
      {
        type: "separator",
        margin: "sm",
      },
      {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        paddingAll: "0",
        contents: [
          {
            type: "text",
            text: resolveLocaleText(HOW_TO_USE_NOTE_TITLE, locale),
            weight: "bold",
            size: "sm",
            color: "#3D2A19",
          },
          {
            type: "text",
            text: resolveLocaleText(HOW_TO_USE_NOTE_BODY, locale),
            wrap: true,
            size: "sm",
            color: "#8C7358",
          },
        ],
      },
    ],
  }
}

function buildHowToUseBubble(locale: ChatLocale) {
  return {
    type: "bubble",
    hero: buildHero(BOT_IMAGE.how_to_use),
    body: buildHowToUseBody(locale),
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      alignItems: "center",
      paddingAll: "18px",
      contents: [
        buildWelcomeFlexLink(
          resolveLocaleText(HOW_TO_USE_LINK, locale),
          "how_to_use",
        ),
      ],
    },
  }
}

function buildFaqBody(locale: ChatLocale) {
  return {
    type: "box",
    layout: "vertical",
    spacing: "md",
    paddingAll: "20px",
    contents: [
      {
        type: "text",
        text: resolveLocaleText(FAQ_TITLE, locale),
        weight: "bold",
        size: "md",
        color: "#3D2A19",
      },
      {
        type: "text",
        text: resolveLocaleText(FAQ_BODY_LINES, locale),
        wrap: true,
        size: "sm",
        color: "#8C7358",
      },
    ],
  }
}

function buildFaqBubble(locale: ChatLocale) {
  return {
    type: "bubble",
    hero: buildHero(BOT_IMAGE.faq),
    body: buildFaqBody(locale),
    footer: buildWelcomePrimaryFooter(
      FAQ_BUTTONS.map((button) => ({
        label: resolveLocaleText(button.label, locale),
        action: button.action,
      })),
    ),
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
    color: "#007AFF",
    align: "center",
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
    body: buildWelcomeBodyBox({
      title: resolveLocaleText(QUICK_MENU_TITLE, locale),
      subtitle: resolveLocaleText(TERMS_OF_USE, locale),
    }),
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "18px",
      contents: [
        ...WELCOME_QUICK_MENU_BUTTONS.map((button) =>
          buildWelcomeFlexButton(
            resolveLocaleText(button.label, locale),
            button.action,
          ),
        ),
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          paddingTop: "12px",
          paddingBottom: "8px",
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
            {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              alignItems: "center",
              paddingTop: "12px",
              contents: [
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
          ],
        },
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
  return {
    type: "carousel",
    contents: [
      buildWelcomeQuickMenuBubble(locale),
      buildHowToUseBubble(locale),
      buildFaqBubble(locale),
    ],
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
