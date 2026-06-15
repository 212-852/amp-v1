import { ChevronRight, Mail, PawPrint } from "lucide-react"
import { SiGoogle, SiLine } from "react-icons/si"

import { getOverlayModalAnimationClass } from "@/components/overlay/animations"
import type {
  OverlayItem,
  OverlayPhase,
  OverlayRule,
} from "@/components/overlay/types"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"

const content = {
  close_label: {
    ja: "閉じる",
    en: "Close overlay",
    es: "Cerrar",
  },
  link_title: {
    ja: "Link",
    en: "Link",
    es: "Vincular",
  },
  link_description: {
    ja: "アカウントを連携すると、別の端末でも続けて使えて通知も受け取れます。",
    en: "Connect your account to continue across devices and receive notifications.",
    es: "Conecta tu cuenta para continuar en otros dispositivos y recibir notificaciones.",
  },
  line_title: {
    ja: "LINE連携",
    en: "LINE Link",
    es: "Vincular LINE",
  },
  line_badge: {
    ja: "おすすめ",
    en: "Recommended",
    es: "Recomendado",
  },
  line_description: {
    ja: "通知やログインが簡単になります",
    en: "Makes notifications and login easier",
    es: "Facilita las notificaciones y el inicio de sesion",
  },
  google_title: {
    ja: "Google",
    en: "Google",
    es: "Google",
  },
  google_description: {
    ja: "Googleアカウントでログイン",
    en: "Log in with your Google account",
    es: "Inicia sesion con tu cuenta de Google",
  },
  email_title: {
    ja: "eMail",
    en: "eMail",
    es: "eMail",
  },
  email_description: {
    ja: "メールアドレスでログイン",
    en: "Log in with your email address",
    es: "Inicia sesion con tu correo electronico",
  },
  language_title: {
    ja: "言語",
    en: "Language",
    es: "Idioma",
  },
  language_description: {
    ja: "表示言語を選択してください。",
    en: "Choose display language.",
    es: "Elige el idioma de visualizacion.",
  },
  language_ja: {
    ja: "日本語",
    en: "日本語",
    es: "日本語",
  },
  language_en: {
    ja: "English",
    en: "English",
    es: "English",
  },
  language_es: {
    ja: "Espanol",
    en: "Espanol",
    es: "Espanol",
  },
  my_page_title: {
    ja: "My Page",
    en: "My Page",
    es: "Mi pagina",
  },
  my_page_description: {
    ja: "アカウントとプロフィールの操作。",
    en: "Account and profile actions.",
    es: "Acciones de cuenta y perfil.",
  },
  profile: {
    ja: "プロフィール",
    en: "Profile",
    es: "Perfil",
  },
  reservations: {
    ja: "予約",
    en: "Reservations",
    es: "Reservas",
  },
  linked_identity: {
    ja: "連携済みID",
    en: "Linked identity",
    es: "Identidad vinculada",
  },
  menu_title: {
    ja: "Menu",
    en: "Menu",
    es: "Menu",
  },
  menu_description: {
    ja: "ナビゲーションとアプリ操作。",
    en: "Navigation and app actions.",
    es: "Navegacion y acciones de la app.",
  },
  dashboard: {
    ja: "Dashboard",
    en: "Dashboard",
    es: "Panel",
  },
  support: {
    ja: "サポート",
    en: "Support",
    es: "Soporte",
  },
  settings: {
    ja: "設定",
    en: "Settings",
    es: "Ajustes",
  },
  notice_title: {
    ja: "Notice",
    en: "Notice",
    es: "Avisos",
  },
  notice_description: {
    ja: "最新通知と必要な操作。",
    en: "Latest notifications and required actions.",
    es: "Notificaciones recientes y acciones necesarias.",
  },
  reservation_updates: {
    ja: "予約の更新",
    en: "Reservation updates",
    es: "Actualizaciones de reserva",
  },
  driver_messages: {
    ja: "ドライバーからのメッセージ",
    en: "Driver messages",
    es: "Mensajes del conductor",
  },
  system_notices: {
    ja: "システム通知",
    en: "System notices",
    es: "Avisos del sistema",
  },
}

function getModalLayoutClass(rule: OverlayRule) {
  if (rule.placement === "bottom") {
    return [
      "w-full max-w-none rounded-t-[28px] rounded-b-none border-b-0",
      "pb-[calc(env(safe-area-inset-bottom)+16px)]",
    ].join(" ")
  }

  if (rule.placement === "left") {
    return [
      "h-dvh w-[min(82vw,360px)] max-w-none rounded-none rounded-r-[28px] border-l-0",
      "overflow-y-auto",
      "pt-[calc(env(safe-area-inset-top)+24px)]",
      "pb-[calc(env(safe-area-inset-bottom)+24px)]",
    ].join(" ")
  }

  return [
    "fixed left-1/2 top-1/2 w-[calc(100%-40px)]",
    "max-w-[380px] rounded-[28px] py-5",
  ].join(" ")
}

function getLinkHref(action: NonNullable<OverlayItem["action"]>) {
  return `/api/auth/${action}`
}

function handleLinkOption(item: OverlayItem) {
  if (!item.action) {
    return
  }

  window.location.href = getLinkHref(item.action)
}

function get_modal_title(rule: OverlayRule, locale: Locale) {
  if (rule.type === "link") {
    return content.link_title[locale]
  }

  if (rule.type === "language") {
    return content.language_title[locale]
  }

  if (rule.type === "my_page") {
    return content.my_page_title[locale]
  }

  if (rule.type === "menu") {
    return content.menu_title[locale]
  }

  if (rule.type === "notice") {
    return content.notice_title[locale]
  }

  return rule.title ?? ""
}

function get_modal_description(rule: OverlayRule, locale: Locale) {
  if (rule.type === "link") {
    return content.link_description[locale]
  }

  if (rule.type === "language") {
    return content.language_description[locale]
  }

  if (rule.type === "my_page") {
    return content.my_page_description[locale]
  }

  if (rule.type === "menu") {
    return content.menu_description[locale]
  }

  if (rule.type === "notice") {
    return content.notice_description[locale]
  }

  return rule.description ?? ""
}

function get_link_item(item: OverlayItem, locale: Locale) {
  if (item.action === "line") {
    return {
      title: content.line_title[locale],
      badge: content.line_badge[locale],
      description: content.line_description[locale],
    }
  }

  if (item.action === "google") {
    return {
      title: content.google_title[locale],
      badge: null,
      description: content.google_description[locale],
    }
  }

  return {
    title: content.email_title[locale],
    badge: null,
    description: content.email_description[locale],
  }
}

function get_language_label(item: OverlayItem, locale: Locale) {
  if (item.locale === "ja") {
    return content.language_ja[locale]
  }

  if (item.locale === "es") {
    return content.language_es[locale]
  }

  return content.language_en[locale]
}

function get_default_label(item: OverlayItem, locale: Locale) {
  if (item.id === "profile") {
    return content.profile[locale]
  }

  if (item.id === "reservations") {
    return content.reservations[locale]
  }

  if (item.id === "linked_identity") {
    return content.linked_identity[locale]
  }

  if (item.id === "dashboard") {
    return content.dashboard[locale]
  }

  if (item.id === "support") {
    return content.support[locale]
  }

  if (item.id === "settings") {
    return content.settings[locale]
  }

  if (item.id === "reservation_updates") {
    return content.reservation_updates[locale]
  }

  if (item.id === "driver_messages") {
    return content.driver_messages[locale]
  }

  if (item.id === "system_notices") {
    return content.system_notices[locale]
  }

  return item.title ?? ""
}

function LinkOptionIcon({ action }: Readonly<{ action: OverlayItem["action"] }>) {
  if (action === "line") {
    return <SiLine className="h-7 w-7 text-[#06c755]" aria-hidden="true" />
  }

  if (action === "google") {
    return <SiGoogle className="h-7 w-7 text-[#4285f4]" aria-hidden="true" />
  }

  return <Mail className="h-7 w-7 text-[#8f5d28]" strokeWidth={2} aria-hidden="true" />
}

function LinkOption({
  item,
  locale,
}: Readonly<{
  item: OverlayItem
  locale: Locale
}>) {
  const link_item = get_link_item(item, locale)

  return (
    <button
      type="button"
      onClick={() => handleLinkOption(item)}
      className={[
        "grid min-h-[86px] w-full grid-cols-[44px_minmax(0,1fr)_24px]",
        "items-center gap-3 rounded-[18px] border border-[#e5e5e5]",
        "bg-white px-4 py-3 text-left text-[#111111]",
        "transition-colors hover:bg-[#fdfaf6] focus-visible:outline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f5d28]",
      ].join(" ")}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f8f8f8]">
        <LinkOptionIcon action={item.action} />
      </span>

      <span className="min-w-0">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[15px] font-bold leading-5">
            {link_item.title}
          </span>
          {link_item.badge ? (
            <span className="shrink-0 rounded-full bg-[#06c755] px-2 py-0.5 text-[11px] font-bold leading-none text-white">
              {link_item.badge}
            </span>
          ) : null}
        </span>
        {link_item.description ? (
          <span className="mt-1 block text-[12px] font-semibold leading-5 text-[#777777]">
            {link_item.description}
          </span>
        ) : null}
      </span>

      <ChevronRight
        className="h-5 w-5 justify-self-end text-[#9a9a9a]"
        strokeWidth={2.4}
        aria-hidden="true"
      />
    </button>
  )
}

function LanguageOption({
  item,
  locale,
  set_locale,
  onClose,
}: Readonly<{
  item: OverlayItem
  locale: Locale
  set_locale: (locale: Locale) => void
  onClose: () => void
}>) {
  return (
    <button
      type="button"
      onClick={() => {
        if (item.locale) {
          set_locale(item.locale)
          onClose()
        }
      }}
      className={[
        "flex min-h-[54px] items-center justify-between rounded-2xl",
        "border border-[#e5e5e5] px-4 py-3 text-left",
        "text-[14px] font-semibold text-[#111111]",
        "transition-colors hover:bg-[#fdfaf6] focus-visible:outline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f5d28]",
      ].join(" ")}
    >
      <span>{get_language_label(item, locale)}</span>
      {item.locale === locale ? (
        <PawPrint
          className="h-5 w-5 fill-[#f48ca8] text-[#f48ca8]"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      ) : null}
    </button>
  )
}

function DefaultOption({
  item,
  locale,
}: Readonly<{
  item: OverlayItem
  locale: Locale
}>) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-[#e5e5e5] px-4 py-3 text-left text-[14px] font-semibold text-[#111111]"
    >
      {get_default_label(item, locale)}
    </button>
  )
}

export default function OverlayModal({
  rule,
  phase,
  onClose,
}: Readonly<{
  rule: OverlayRule
  phase: OverlayPhase
  onClose: () => void
}>) {
  const { locale, set_locale } = useLocale()
  const modal_title = get_modal_title(rule, locale)
  const modal_description = get_modal_description(rule, locale)

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlay-title"
      className={[
        getModalLayoutClass(rule),
        "border border-[#e5e5e5] bg-white px-5 text-[#111111]",
        "shadow-[0_18px_50px_rgba(0,0,0,0.12)]",
        "will-change-transform",
        getOverlayModalAnimationClass(rule.animation, phase),
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="overlay-title"
            className="mb-4 text-[24px] font-bold tracking-[-0.03em]"
          >
            {modal_title}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e5e5e5] text-[18px] leading-none text-[#777777]"
          aria-label={content.close_label[locale]}
        >
          ×
        </button>
      </div>

      <p className="mt-3 text-[13px] font-medium leading-6 text-[#777777]">
        {modal_description}
      </p>

      <div className="mt-5 grid gap-2">
        {rule.items.map((item) => (
          rule.type === "link" ? (
            <LinkOption key={item.id} item={item} locale={locale} />
          ) : rule.type === "language" ? (
            <LanguageOption
              key={item.id}
              item={item}
              locale={locale}
              set_locale={set_locale}
              onClose={onClose}
            />
          ) : (
            <DefaultOption key={item.id} item={item} locale={locale} />
          )
        ))}
      </div>
    </section>
  )
}
