"use client"

import type { ClipboardEvent, KeyboardEvent } from "react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { ChevronRight, LogOut, Mail, PawPrint, User } from "lucide-react"
import { SiGoogle, SiLine } from "react-icons/si"

import { getOverlayModalAnimationClass } from "@/components/overlay/animations"
import type {
  OverlayAccount,
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
  close_action: {
    ja: "閉じる",
    en: "Close",
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
  account_title: {
    ja: "Account",
    en: "Account",
    es: "Cuenta",
  },
  account_description: {
    ja: "アカウント情報とログアウト。",
    en: "Account details and logout.",
    es: "Detalles de cuenta y cierre de sesion.",
  },
  account_guest_name: {
    ja: "Member",
    en: "Member",
    es: "Miembro",
  },
  logout: {
    ja: "ログアウト",
    en: "Logout",
    es: "Cerrar sesion",
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
    ja: "Email",
    en: "Email",
    es: "Email",
  },
  email_description: {
    ja: "メールアドレスでログイン",
    en: "Log in with your email address",
    es: "Inicia sesion con tu correo electronico",
  },
  email_step_description: {
    ja: "メールアドレスに認証コードを送信します",
    en: "We will send a verification code to your email address.",
    es: "Enviaremos un codigo de verificacion a tu correo.",
  },
  email_input_label: {
    ja: "メールアドレス",
    en: "Email address",
    es: "Correo electronico",
  },
  send_code: {
    ja: "認証コードを送信",
    en: "Send code",
    es: "Enviar codigo",
  },
  email_code_description: {
    ja: "メールに届いた6桁コードを入力してください",
    en: "Enter the 6 digit code sent to your email.",
    es: "Ingresa el codigo de 6 digitos enviado a tu correo.",
  },
  verify_code: {
    ja: "ログイン",
    en: "Log in",
    es: "Iniciar sesion",
  },
  resend_code: {
    ja: "コードを再送",
    en: "Resend code",
    es: "Reenviar codigo",
  },
  back_to_link: {
    ja: "戻る",
    en: "Back",
    es: "Volver",
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

async function send_identity_link_started(action: NonNullable<OverlayItem["action"]>) {
  await fetch("/api/auth/identity/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: action,
    }),
  })
}

async function start_google_link() {
  window.location.href = "/api/auth/google/start"
}

async function handleLinkOption(item: OverlayItem) {
  if (!item.action) {
    return
  }

  if (item.action === "google") {
    await start_google_link()
    return
  }

  if (item.action === "email") {
    return
  }

  await send_identity_link_started(item.action)
  window.location.href = "/api/auth/line"
}

function get_modal_title(rule: OverlayRule, locale: Locale) {
  if (rule.type === "account") {
    return content.account_title[locale]
  }

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
  if (rule.type === "account") {
    return content.account_description[locale]
  }

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

function AccountProviderIcon({
  provider,
}: Readonly<{ provider: OverlayAccount["provider"] }>) {
  if (provider === "google") {
    return <SiGoogle className="h-5 w-5 text-[#4285f4]" aria-hidden="true" />
  }

  if (provider === "line") {
    return <SiLine className="h-5 w-5 text-[#06c755]" aria-hidden="true" />
  }

  if (provider === "email") {
    return <Mail className="h-5 w-5 text-[#8f5d28]" strokeWidth={2} aria-hidden="true" />
  }

  return <User className="h-5 w-5 text-[#8f5d28]" strokeWidth={2} aria-hidden="true" />
}

function AccountAvatar({ rule }: Readonly<{ rule: OverlayRule }>) {
  const account = rule.account

  if (account?.image_url) {
    return (
      <span
        className="block h-full w-full rounded-full bg-cover bg-center"
        style={{ backgroundImage: `url(${account.image_url})` }}
        aria-hidden="true"
      />
    )
  }

  return <AccountProviderIcon provider={account?.provider ?? null} />
}

function AccountPanel({
  rule,
  locale,
  onClose,
}: Readonly<{
  rule: OverlayRule
  locale: Locale
  onClose: () => void
}>) {
  const [is_logging_out, set_is_logging_out] = useState(false)
  const account = rule.account
  const display_name = account?.display_name ?? content.account_guest_name[locale]

  function handle_logout() {
    if (is_logging_out) {
      return
    }

    set_is_logging_out(true)
    fetch("/api/auth/logout", {
      method: "POST",
    })
      .catch(() => null)
      .finally(() => {
        window.location.href = "/"
      })
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3 rounded-[18px] border border-[#e5e5e5] bg-white px-4 py-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fdfaf6] text-[#8f5d28] ring-1 ring-[#dcc7aa]">
          <AccountAvatar rule={rule} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold leading-5 text-[#111111]">
            {display_name}
          </span>
          <span className="mt-1 flex items-center gap-2 text-[12px] font-semibold leading-5 text-[#777777]">
            <AccountProviderIcon provider={account?.provider ?? null} />
            {account?.email ? <span className="truncate">{account.email}</span> : null}
          </span>
        </span>
      </div>

      <button
        type="button"
        onClick={handle_logout}
        disabled={is_logging_out}
        className={[
          "flex min-h-[54px] items-center justify-between rounded-2xl",
          "border border-[#e5e5e5] px-4 py-3 text-left",
          "text-[14px] font-semibold text-[#111111]",
          "transition-colors hover:bg-[#fdfaf6] focus-visible:outline",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f5d28]",
          is_logging_out ? "cursor-wait opacity-75" : "",
        ].join(" ")}
      >
        <span>{content.logout[locale]}</span>
        <LogOut className="h-5 w-5 text-[#8f5d28]" strokeWidth={2} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onClose}
        className={[
          "flex min-h-[54px] items-center justify-center rounded-2xl",
          "border border-[#e5e5e5] px-4 py-3 text-center",
          "text-[14px] font-semibold text-[#111111]",
          "transition-colors hover:bg-[#fdfaf6] focus-visible:outline",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f5d28]",
        ].join(" ")}
      >
        {content.close_action[locale]}
      </button>
    </div>
  )
}

function LinkOption({
  item,
  locale,
  loading_action,
  on_link_click,
}: Readonly<{
  item: OverlayItem
  locale: Locale
  loading_action: OverlayItem["action"] | null
  on_link_click: (item: OverlayItem) => void
}>) {
  const link_item = get_link_item(item, locale)
  const is_loading = loading_action === item.action

  return (
    <button
      type="button"
      disabled={Boolean(loading_action)}
      onClick={() => on_link_click(item)}
      className={[
        "grid min-h-[86px] w-full grid-cols-[44px_minmax(0,1fr)_24px]",
        "items-center gap-3 rounded-[18px] border border-[#e5e5e5]",
        "bg-white px-4 py-3 text-left text-[#111111]",
        "transition-colors hover:bg-[#fdfaf6] focus-visible:outline",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8f5d28]",
        loading_action ? "cursor-wait opacity-75" : "",
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

      {is_loading ? (
        <span
          className="h-4 w-4 justify-self-end rounded-full border-2 border-[#dcc7aa] border-t-[#8f5d28]"
          aria-hidden="true"
        />
      ) : (
        <ChevronRight
          className="h-5 w-5 justify-self-end text-[#9a9a9a]"
          strokeWidth={2.4}
          aria-hidden="true"
        />
      )}
    </button>
  )
}

async function post_json(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const result = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    message?: string
    reason?: string
  }

  if (!response.ok || result.ok === false) {
    throw new Error(result.message ?? result.error ?? "Request failed")
  }

  return result
}

function EmailLoginPanel({
  locale,
  onBack,
  onClose,
}: Readonly<{
  locale: Locale
  onBack: () => void
  onClose: () => void
}>) {
  const router = useRouter()
  const [email, set_email] = useState("")
  const [step, set_step] = useState<"email" | "code">("email")
  const [otp_digits, set_otp_digits] = useState<string[]>(["", "", "", "", "", ""])
  const [error, set_error] = useState<string | null>(null)
  const [loading, set_loading] = useState(false)
  const input_refs = useRef<Array<HTMLInputElement | null>>([])
  const submitted_otp_ref = useRef<string | null>(null)
  const otp = otp_digits.join("")
  const can_verify = otp.length === 6 && otp_digits.every(Boolean) && !loading

  const focus_digit = useCallback((index: number) => {
    window.setTimeout(() => {
      input_refs.current[index]?.focus()
    }, 0)
  }, [])

  const clear_digits = useCallback(() => {
    set_otp_digits(["", "", "", "", "", ""])
    focus_digit(0)
  }, [focus_digit])

  function handle_digit_change(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1)

    set_otp_digits((current) => {
      const next = [...current]
      next[index] = digit
      return next
    })

    if (digit && index < 5) {
      focus_digit(index + 1)
    }
  }

  function handle_digit_key_down(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key !== "Backspace") {
      return
    }

    if (!otp_digits[index] && index > 0) {
      event.preventDefault()
      focus_digit(index - 1)
    }
  }

  function handle_paste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)

    if (!pasted) {
      return
    }

    event.preventDefault()
    set_otp_digits(
      Array.from({ length: 6 }, (_, index) => pasted[index] ?? ""),
    )
    focus_digit(Math.min(pasted.length, 6) - 1)
  }

  function handle_send_code() {
    if (loading) {
      return
    }

    set_error(null)
    set_otp_digits(["", "", "", "", "", ""])
    set_loading(true)
    post_json("/api/auth/otp/send", {
      channel: "email",
      target: email,
    })
      .then(() => {
        set_step("code")
        focus_digit(0)
      })
      .catch((send_error) => {
        set_error(
          send_error instanceof Error ? send_error.message : "Failed to send code",
        )
      })
      .finally(() => {
        set_loading(false)
      })
  }

  const handle_verify_code = useCallback(() => {
    if (!can_verify) {
      return
    }

    set_error(null)
    set_loading(true)
    submitted_otp_ref.current = otp
    post_json("/api/auth/otp/verify", {
      channel: "email",
      target: email,
      code: otp,
    })
      .then(() => {
        onClose()
        router.refresh()
      })
      .catch((verify_error) => {
        set_error(
          verify_error instanceof Error ? verify_error.message : "Failed to verify code",
        )
        clear_digits()
        submitted_otp_ref.current = null
      })
      .finally(() => {
        set_loading(false)
      })
  }, [can_verify, clear_digits, email, onClose, otp, router])

  useEffect(() => {
    if (step !== "code" || !can_verify || submitted_otp_ref.current === otp) {
      return
    }

    handle_verify_code()
  }, [can_verify, handle_verify_code, otp, step])

  return (
    <div className="grid gap-3">
      <p className="text-[13px] font-medium leading-6 text-[#777777]">
        {step === "email"
          ? content.email_step_description[locale]
          : content.email_code_description[locale]}
      </p>

      {step === "email" ? (
        <label className="grid gap-1.5 text-[12px] font-bold text-[#777777]">
          {content.email_input_label[locale]}
          <input
            type="email"
            value={email}
            disabled={loading}
            onChange={(event) => {
              set_email(event.target.value)
            }}
            className="h-12 rounded-2xl border border-[#e5e5e5] px-4 text-[15px] font-semibold text-[#111111] outline-none focus:border-[#8f5d28]"
            autoComplete="email"
          />
        </label>
      ) : (
        <div className="grid grid-cols-6 gap-2">
          {otp_digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                input_refs.current[index] = element
              }}
              type="text"
              value={digit}
              disabled={loading}
              onChange={(event) => handle_digit_change(index, event.target.value)}
              onKeyDown={(event) => handle_digit_key_down(index, event)}
              onPaste={handle_paste}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              style={{ fontSize: "24px" }}
              className="h-14 w-12 rounded-xl border border-[#e5e5e5] text-center text-[24px] font-bold text-[#111111] outline-none focus:border-[#8f5d28]"
            />
          ))}
        </div>
      )}

      {error ? (
        <p className="rounded-2xl border border-[#f1c7c7] bg-[#fff6f6] px-4 py-3 text-[12px] font-semibold leading-5 text-[#9a3333]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={step === "code" ? !can_verify : loading}
        onClick={step === "email" ? handle_send_code : handle_verify_code}
        className={[
          "flex min-h-[54px] items-center justify-center rounded-2xl",
          "border border-[#e5e5e5] bg-[#8f5d28] px-4 py-3 text-center",
          "text-[14px] font-semibold text-white",
          loading || (step === "code" && !can_verify)
            ? "cursor-not-allowed opacity-75"
            : "",
        ].join(" ")}
      >
        {step === "email" ? content.send_code[locale] : content.verify_code[locale]}
      </button>

      {step === "code" ? (
        <button
          type="button"
          disabled={loading}
          onClick={handle_send_code}
          className="min-h-[48px] rounded-2xl border border-[#e5e5e5] px-4 py-3 text-[14px] font-semibold text-[#111111]"
        >
          {content.resend_code[locale]}
        </button>
      ) : null}

      <button
        type="button"
        disabled={loading}
        onClick={onBack}
        className="min-h-[48px] rounded-2xl border border-[#e5e5e5] px-4 py-3 text-[14px] font-semibold text-[#111111]"
      >
        {content.back_to_link[locale]}
      </button>
    </div>
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
  const [loading_action, set_loading_action] = useState<OverlayItem["action"] | null>(null)
  const [link_step, set_link_step] = useState<"options" | "email">("options")
  const modal_title = get_modal_title(rule, locale)
  const display_title =
    rule.type === "link" && link_step === "email"
      ? content.email_title[locale]
      : modal_title
  const modal_description = get_modal_description(rule, locale)

  function handle_link_click(item: OverlayItem) {
    if (!item.action || loading_action) {
      return
    }

    if (item.action === "email") {
      set_link_step("email")
      return
    }

    set_loading_action(item.action)
    handleLinkOption(item).catch(() => {
      set_loading_action(null)
    })
  }

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
            {display_title}
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

      {rule.type === "link" && link_step === "email" ? null : (
        <p className="mt-3 text-[13px] font-medium leading-6 text-[#777777]">
          {modal_description}
        </p>
      )}

      <div className="mt-5 grid gap-2">
        {rule.type === "account" ? (
          <AccountPanel rule={rule} locale={locale} onClose={onClose} />
        ) : rule.type === "link" && link_step === "email" ? (
          <EmailLoginPanel
            locale={locale}
            onBack={() => set_link_step("options")}
            onClose={onClose}
          />
        ) : (
          rule.items.map((item) => (
            rule.type === "link" ? (
            <LinkOption
              key={item.id}
              item={item}
              locale={locale}
              loading_action={loading_action}
              on_link_click={handle_link_click}
            />
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
          ))
        )}
      </div>
    </section>
  )
}
