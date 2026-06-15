"use client"

import { Bell, Globe2, User } from "lucide-react"

import { useOverlay } from "@/components/overlay"
import { useLocale } from "@/src/components/locale/provider"

const mock_auth = {
  is_logged_in: false,
  is_linked: false,
}

const content = {
  brand: {
    ja: "PET TAXI",
    en: "PET TAXI",
    es: "PET TAXI",
  },
  breadcrumb_home: {
    ja: "ホーム",
    en: "Home",
    es: "Inicio",
  },
  guest: {
    ja: "Guest",
    en: "Guest",
    es: "Invitado",
  },
  member: {
    ja: "メンバー",
    en: "Member",
    es: "Miembro",
  },
  link: {
    ja: "連携",
    en: "Link",
    es: "Vincular",
  },
  linked: {
    ja: "連携済み",
    en: "Linked",
    es: "Vinculado",
  },
  test_user: {
    ja: "Test User",
    en: "Test User",
    es: "Usuario de prueba",
  },
  notifications_label: {
    ja: "通知",
    en: "Notifications",
    es: "Notificaciones",
  },
  language_label: {
    ja: "Language JA",
    en: "Language EN",
    es: "Language ES",
  },
  user_profile_label: {
    ja: "ユーザープロフィール",
    en: "User profile",
    es: "Perfil de usuario",
  },
}

function MemberPill({ label, filled = false }: { label: string; filled?: boolean }) {
  return (
    <span
      className={[
        "inline-flex h-7 items-center rounded-full px-2.5 text-[12px] font-semibold leading-none",
        filled
          ? "bg-[#8f5d28] text-[#fdfaf6]"
          : "bg-[#fdfaf6] text-[#8f5d28] ring-1 ring-[#dcc7aa]",
      ].join(" ")}
    >
      {label}
    </span>
  )
}

function LinkPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[30px] items-center rounded-full bg-[#fdfaf6] px-3 text-[14px] font-semibold leading-none text-[#8f5d28] ring-1 ring-[#dcc7aa]"
    >
      {label}
    </button>
  )
}

function HeaderCurve() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full text-[#ead7c3]"
      preserveAspectRatio="none"
      viewBox="0 0 430 108"
    >
      <path
        d="M0 0H430V86C350 87 302 87 262 87C226 87 206 75 176 66C132 53 88 62 0 92Z"
        fill="currentColor"
      />
    </svg>
  )
}

export default function AppHeader() {
  const { openOverlay } = useOverlay()
  const { locale } = useLocale()
  const language_label = locale.toUpperCase()
  const user_name = mock_auth.is_logged_in
    ? content.test_user[locale]
    : content.guest[locale]

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[108px] text-[#3d2a19]">
      <HeaderCurve />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-[430px] items-start justify-between gap-2 px-6 pb-2 pt-[calc(12px+env(safe-area-inset-top,0px))]">
        <div className="min-w-0 pt-1">
          <h1 className="text-[20px] font-semibold leading-none text-[#3d2a19]">
            {content.brand[locale]}
          </h1>
          <p className="mt-2.5 text-[11px] font-medium leading-none text-[#8c7358]">
            {content.breadcrumb_home[locale]}
          </p>
        </div>

        <div className="flex min-w-[200px] flex-col items-end pt-0.5">
          <div className="flex items-center justify-end gap-1.5">
            {!mock_auth.is_logged_in ? (
              <>
                <MemberPill label={content.guest[locale]} />
                <LinkPill
                  label={content.link[locale]}
                  onClick={() => openOverlay({ type: "link", source: "user" })}
                />
              </>
            ) : mock_auth.is_linked ? (
              <>
                <MemberPill label={content.member[locale]} filled />
                <LinkPill
                  label={content.linked[locale]}
                  onClick={() => openOverlay({ type: "link", source: "user" })}
                />
              </>
            ) : (
              <>
                <MemberPill label={content.member[locale]} filled />
                <LinkPill
                  label={content.link[locale]}
                  onClick={() => openOverlay({ type: "link", source: "user" })}
                />
              </>
            )}
            <button
              type="button"
              aria-label={content.notifications_label[locale]}
              onClick={() => openOverlay({ type: "notice", source: "user" })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fdfaf6] text-[#8f5d28] ring-1 ring-[#dcc7aa]"
            >
              <Bell className="h-[22px] w-[22px]" strokeWidth={2} />
            </button>
            <button
              type="button"
              aria-label={content.language_label[locale]}
              onClick={() =>
                openOverlay({ type: "language", source: "user" })
              }
              className="flex h-8 items-center gap-1 rounded-full bg-[#fdfaf6] px-2 text-[#8f5d28] ring-1 ring-[#dcc7aa]"
            >
              <Globe2 className="h-[22px] w-[22px]" strokeWidth={2} />
              <span className="text-[14px] font-semibold leading-none">
                {language_label}
              </span>
            </button>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span className="max-w-[112px] truncate text-[14px] font-semibold leading-none text-[#8c7358]">
              {user_name}
            </span>
            <button
              type="button"
              aria-label={content.user_profile_label[locale]}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8f5d28] text-[#fdfaf6]"
            >
              <User className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
