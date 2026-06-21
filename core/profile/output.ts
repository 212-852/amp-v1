import type { Session } from "@/core/auth/types"
import type { NotificationType } from "@/core/chat/types"
import {
  resolve_profile_display_name,
  type ProfileLocale,
} from "@/core/profile/rules"

export type ProfileDisplayPayload = {
  user_uuid: string | null
  visitor_uuid: string | null
  nickname: string | null
  first_name: string | null
  last_name: string | null
  birth_date: string | null
  phone: string | null
  prefecture: string | null
  city: string | null
  prefecture_code: string | null
  city_code: string | null
  address: string | null
  memo: string | null
  display_name: string
  image_url: string | null
  role: string
  tier: string | null
  language: ProfileLocale
  locale: ProfileLocale
  notification_type?: NotificationType
}

export function build_profile_output(input: {
  session: Session
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  birth_date?: string | null
  phone?: string | null
  prefecture?: string | null
  city?: string | null
  prefecture_code?: string | null
  city_code?: string | null
  address?: string | null
  memo?: string | null
  users_name?: string | null
  image_url?: string | null
  locale?: ProfileLocale | null
  notification_type?: NotificationType | null
}): ProfileDisplayPayload {
  const display_name = resolve_profile_display_name({
    nickname: input.nickname,
    first_name: input.first_name,
    last_name: input.last_name,
    users_name: input.users_name ?? input.session.display_name,
    fallback: "Guest",
  })

  return {
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    nickname: input.nickname ?? null,
    first_name: input.first_name ?? null,
    last_name: input.last_name ?? null,
    birth_date: input.birth_date ?? null,
    phone: input.phone ?? null,
    prefecture: input.prefecture ?? null,
    city: input.city ?? null,
    prefecture_code: input.prefecture_code ?? null,
    city_code: input.city_code ?? null,
    address: input.address ?? null,
    memo: input.memo ?? null,
    display_name,
    image_url: input.image_url ?? input.session.image_url ?? null,
    role: input.session.role,
    tier: input.session.tier ?? null,
    language: input.locale ?? "ja",
    locale: input.locale ?? "ja",
    notification_type:
      input.notification_type === "pwa_push" ? "pwa_push" : "line",
  }
}
