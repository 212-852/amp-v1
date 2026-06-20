"use client"

import { Bell, Globe2, Mail, User } from "lucide-react"
import { SiGoogle, SiLine } from "react-icons/si"
import { useState } from "react"

import { useOverlay } from "@/components/overlay"
import ProfileSettings from "@/components/profile/settings"
import { get_display_name } from "@/core/profile/display"
import type { ProfileDisplayPayload } from "@/core/profile/output"
import { useLocale } from "@/src/components/locale/provider"

export type AppHeaderAuth = {
  visitor_uuid?: string | null
  user_uuid: string | null
  role: string
  tier: string
  display_name: string | null
  image_url: string | null
  provider: "google" | "line" | "email" | null
  email: string | null
  can_logout: boolean
  can_start_line_oauth: boolean
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

function resolveInitials(value: string | null | undefined) {
  const normalized = value?.trim()

  if (!normalized) {
    return "U"
  }

  const parts = normalized.split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
  }

  return normalized.slice(0, 2).toUpperCase()
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

function ProviderIcon({
  provider,
  className = "h-4 w-4",
}: {
  provider: AppHeaderAuth["provider"]
  className?: string
}) {
  if (provider === "google") {
    return <SiGoogle className={className} aria-hidden="true" />
  }

  if (provider === "line") {
    return <SiLine className={className} aria-hidden="true" />
  }

  if (provider === "email") {
    return <Mail className={className} strokeWidth={2} aria-hidden="true" />
  }

  return <User className={className} strokeWidth={2} aria-hidden="true" />
}

function LinkPill({
  label,
  provider,
  onClick,
}: {
  label: string
  provider?: AppHeaderAuth["provider"]
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[30px] min-w-[42px] items-center justify-center rounded-full bg-[#fdfaf6] px-3 text-[14px] font-semibold leading-none text-[#8f5d28] ring-1 ring-[#dcc7aa]"
    >
      {provider ? <ProviderIcon provider={provider} /> : label}
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

function UserAvatar({ auth }: { auth: AppHeaderAuth }) {
  if (auth.image_url) {
    return (
      <span
        className="block h-full w-full rounded-full bg-cover bg-center"
        style={{ backgroundImage: `url(${auth.image_url})` }}
        aria-hidden="true"
      />
    )
  }

  return (
    <span className="text-[13px] font-bold leading-none">
      {resolveInitials(auth.display_name ?? auth.email ?? auth.role ?? auth.user_uuid)}
    </span>
  )
}

export default function AppHeader({ auth }: { auth: AppHeaderAuth }) {
  const { openOverlay } = useOverlay()
  const { locale } = useLocale()
  const [settings_open, set_settings_open] = useState(false)
  const [saved_profile, set_saved_profile] =
    useState<ProfileDisplayPayload | null>(null)
  const display_name = get_display_name(saved_profile, {
    name: auth.display_name,
    email: auth.email,
    role: auth.role,
    fallback: content.guest[locale],
  })
  const image_url = saved_profile?.image_url ?? auth.image_url
  const language_label = locale.toUpperCase()
  const is_logged_in = Boolean(auth.user_uuid)
  const is_linked = Boolean(auth.provider)
  const user_name = is_logged_in
    ? display_name
    : content.guest[locale]
  const display_auth = {
    ...auth,
    display_name,
    image_url,
  }
  const open_account_link = () => {
    if (!is_logged_in) {
      openOverlay({
        type: "link",
        source: "user",
        can_start_line_oauth: auth.can_start_line_oauth,
      })
      return
    }

    openOverlay({
      type: "account",
      source: "user",
      account: {
        user_uuid: auth.user_uuid,
        display_name,
        image_url,
        provider: auth.provider,
        email: auth.email,
        can_logout: auth.can_logout,
      },
    })
  }

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
            {!is_logged_in ? (
              <>
                <MemberPill label={content.guest[locale]} />
                <LinkPill
                  label={content.link[locale]}
                  onClick={open_account_link}
                />
              </>
            ) : is_linked ? (
              <>
                <MemberPill label={auth.role} filled />
                <MemberPill label={auth.tier} />
                <LinkPill
                  label={content.linked[locale]}
                  provider={auth.provider}
                  onClick={open_account_link}
                />
              </>
            ) : (
              <>
                <MemberPill label={auth.role} filled />
                <MemberPill label={auth.tier} />
                <LinkPill
                  label={content.link[locale]}
                  onClick={open_account_link}
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
              onClick={() => set_settings_open(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8f5d28] text-[#fdfaf6]"
            >
              <UserAvatar auth={display_auth} />
            </button>
          </div>
        </div>
      </div>
      <ProfileSettings
        open={settings_open}
        initial_profile={{
          user_uuid: auth.user_uuid,
          visitor_uuid: auth.visitor_uuid ?? null,
          nickname: saved_profile?.nickname ?? null,
          first_name: saved_profile?.first_name ?? null,
          last_name: saved_profile?.last_name ?? null,
          birth_date: saved_profile?.birth_date ?? null,
          phone: saved_profile?.phone ?? null,
          prefecture: saved_profile?.prefecture ?? null,
          city: saved_profile?.city ?? null,
          prefecture_code: saved_profile?.prefecture_code ?? null,
          city_code: saved_profile?.city_code ?? null,
          address: saved_profile?.address ?? null,
          memo: saved_profile?.memo ?? null,
          display_name: user_name,
          image_url,
          role: auth.role,
          tier: auth.tier,
          language: saved_profile?.language ?? locale,
          locale,
        }}
        onClose={() => set_settings_open(false)}
        onSaved={set_saved_profile}
      />
    </header>
  )
}
