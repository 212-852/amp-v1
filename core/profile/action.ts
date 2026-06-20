import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { normalize_profile_context } from "@/core/profile/context"
import { build_profile_output } from "@/core/profile/output"
import type {
  ProfileLocale,
  ProfileSettingsPatch,
} from "@/core/profile/rules"
import type { Session } from "@/core/auth/types"
import { assert_valid_address_selection } from "@/src/address/action"

type ProfileRow = {
  profile_uuid?: string | null
  user_uuid?: string | null
  visitor_uuid?: string | null
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
  language?: ProfileLocale | null
  locale?: ProfileLocale | null
}

type UserNameRow = {
  name?: string | null
  display_name?: string | null
}

function patch_has_profile_fields(patch: ProfileSettingsPatch) {
  return (
    "nickname" in patch ||
    "first_name" in patch ||
    "last_name" in patch ||
    "birth_date" in patch ||
    "phone" in patch ||
    "prefecture" in patch ||
    "city" in patch ||
    "prefecture_code" in patch ||
    "city_code" in patch ||
    "address" in patch ||
    "memo" in patch ||
    "language" in patch ||
    "locale" in patch
  )
}

function build_profile_db_patch(patch: ProfileSettingsPatch) {
  const body: Record<string, unknown> = {}

  for (const key of [
    "nickname",
    "first_name",
    "last_name",
    "birth_date",
    "phone",
    "prefecture",
    "city",
    "prefecture_code",
    "city_code",
    "address",
    "memo",
  ] as const) {
    if (key in patch) {
      body[key] = patch[key]
    }
  }

  if (patch.language) {
    body.language = patch.language
  }

  if (patch.locale) {
    body.locale = patch.locale
  }
  return body
}

async function load_user_name(user_uuid: string | null) {
  const config = getRestConfig()

  if (!config || !user_uuid) {
    return null
  }

  const queries = [
    "select=name&limit=1",
    "select=display_name&limit=1",
  ]

  for (const query of queries) {
    const response = await fetch(
      restUrl(
        config,
        "users",
        `user_uuid=eq.${encodeURIComponent(user_uuid)}&${query}`,
      ),
      {
        headers: restHeaders(config),
        cache: "no-store",
      },
    )

    if (!response.ok) {
      continue
    }

    const rows = (await response.json()) as UserNameRow[]
    const row = rows[0]
    const name = row?.name?.trim() || row?.display_name?.trim()

    if (name) {
      return name
    }
  }

  return null
}

async function load_profile_row(session: Session) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const identity_filter = session.user_uuid
    ? `user_uuid=eq.${encodeURIComponent(session.user_uuid)}`
    : session.visitor_uuid
      ? `visitor_uuid=eq.${encodeURIComponent(session.visitor_uuid)}`
      : null

  if (!identity_filter) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "profiles",
      [
        identity_filter,
        "select=profile_uuid,user_uuid,visitor_uuid,nickname,first_name,last_name,birth_date,phone,prefecture,city,prefecture_code,city_code,address,memo,language,locale",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as ProfileRow[]
  return rows[0] ?? null
}

async function upsert_profile_row(input: {
  user_uuid: string | null
  visitor_uuid: string | null
  patch: ProfileSettingsPatch
}) {
  const config = getRestConfig()

  if (!config || !patch_has_profile_fields(input.patch)) {
    return null
  }

  const identity_body = input.user_uuid
    ? { user_uuid: input.user_uuid }
    : input.visitor_uuid
      ? { visitor_uuid: input.visitor_uuid }
      : null

  if (!identity_body) {
    return null
  }

  const conflict_target = input.user_uuid ? "user_uuid" : "visitor_uuid"
  const response = await fetch(
    restUrl(
      config,
      "profiles",
      `on_conflict=${conflict_target}&select=profile_uuid,user_uuid,visitor_uuid,nickname,first_name,last_name,birth_date,phone,prefecture,city,prefecture_code,city_code,address,memo,language,locale`,
    ),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        ...identity_body,
        ...build_profile_db_patch(input.patch),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to save profile")
  }

  const rows = (await response.json()) as ProfileRow[]
  return rows[0] ?? null
}

export async function get_profile_settings(session: Session) {
  const [row, users_name] = await Promise.all([
    load_profile_row(session),
    load_user_name(session.user_uuid),
  ])

  return build_profile_output({
    session,
    nickname: row?.nickname ?? null,
    first_name: row?.first_name ?? null,
    last_name: row?.last_name ?? null,
    birth_date: row?.birth_date ?? null,
    phone: row?.phone ?? null,
    prefecture: row?.prefecture ?? null,
    city: row?.city ?? null,
    prefecture_code: row?.prefecture_code ?? null,
    city_code: row?.city_code ?? null,
    address: row?.address ?? null,
    memo: row?.memo ?? null,
    users_name,
    locale: row?.language ?? row?.locale ?? null,
  })
}

export async function save_profile_settings(input: {
  session: Session
  body: unknown
}) {
  const context = normalize_profile_context(input)
  await assert_valid_address_selection({
    prefecture_code: context.patch.prefecture_code,
    city_code: context.patch.city_code,
  })
  const [row, users_name] = await Promise.all([
    upsert_profile_row({
      user_uuid: context.user_uuid,
      visitor_uuid: context.visitor_uuid,
      patch: context.patch,
    }),
    load_user_name(context.user_uuid),
  ])
  const fallback_row = row ?? (await load_profile_row(input.session))

  return build_profile_output({
    session: input.session,
    nickname:
      fallback_row?.nickname ??
      ("nickname" in context.patch ? context.patch.nickname : null),
    first_name:
      fallback_row?.first_name ??
      ("first_name" in context.patch ? context.patch.first_name : null),
    last_name:
      fallback_row?.last_name ??
      ("last_name" in context.patch ? context.patch.last_name : null),
    birth_date:
      fallback_row?.birth_date ??
      ("birth_date" in context.patch ? context.patch.birth_date : null),
    phone:
      fallback_row?.phone ?? ("phone" in context.patch ? context.patch.phone : null),
    prefecture:
      fallback_row?.prefecture ??
      ("prefecture" in context.patch ? context.patch.prefecture : null),
    city:
      fallback_row?.city ?? ("city" in context.patch ? context.patch.city : null),
    prefecture_code:
      fallback_row?.prefecture_code ??
      ("prefecture_code" in context.patch ? context.patch.prefecture_code : null),
    city_code:
      fallback_row?.city_code ??
      ("city_code" in context.patch ? context.patch.city_code : null),
    address:
      fallback_row?.address ??
      ("address" in context.patch ? context.patch.address : null),
    memo: fallback_row?.memo ?? ("memo" in context.patch ? context.patch.memo : null),
    users_name,
    locale:
      fallback_row?.language ??
      fallback_row?.locale ??
      context.patch.language ??
      context.patch.locale ??
      null,
  })
}
