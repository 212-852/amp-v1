import { setConciergeAvailability } from "@/core/chat/archive"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { normalize_profile_context } from "@/core/profile/context"
import { build_profile_output } from "@/core/profile/output"
import type {
  NotificationPreference,
  ProfileLocale,
  ProfileSettingsPatch,
} from "@/core/profile/rules"
import type { Session } from "@/core/auth/types"

type ProfileRow = {
  display_name?: string | null
  image_url?: string | null
  locale?: ProfileLocale | null
  notification_preference?: NotificationPreference | null
}

function patch_has_profile_fields(patch: ProfileSettingsPatch) {
  return (
    "display_name" in patch ||
    "image_url" in patch ||
    "locale" in patch ||
    "notification_preference" in patch
  )
}

function build_profile_db_patch(patch: ProfileSettingsPatch) {
  const body: Record<string, unknown> = {}

  if ("display_name" in patch) {
    body.display_name = patch.display_name
  }

  if ("image_url" in patch) {
    body.image_url = patch.image_url
  }

  if (patch.locale) {
    body.locale = patch.locale
  }

  if (patch.notification_preference) {
    body.notification_preference = patch.notification_preference
  }

  return body
}

async function patch_profile_table(input: {
  table: "users" | "visitors"
  key: "user_uuid" | "visitor_uuid"
  id: string
  patch: ProfileSettingsPatch
}) {
  const config = getRestConfig()

  if (!config || !patch_has_profile_fields(input.patch)) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      input.table,
      `${input.key}=eq.${encodeURIComponent(input.id)}&select=*`,
    ),
    {
      method: "PATCH",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify(build_profile_db_patch(input.patch)),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    if (input.table === "visitors" && error.code === "PGRST204") {
      return null
    }

    throw new Error(error.message ?? "Failed to save profile")
  }

  const rows = (await response.json()) as ProfileRow[]
  return rows[0] ?? null
}

async function load_profile_row(session: Session) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  if (session.user_uuid) {
    const response = await fetch(
      restUrl(
        config,
        "users",
        [
          `user_uuid=eq.${encodeURIComponent(session.user_uuid)}`,
          "select=display_name,image_url,locale,notification_preference",
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

  if (!session.visitor_uuid) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "visitors",
      [
        `visitor_uuid=eq.${encodeURIComponent(session.visitor_uuid)}`,
        "select=display_name,image_url,locale,notification_preference",
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

export async function get_profile_settings(session: Session) {
  const row = await load_profile_row(session)

  return build_profile_output({
    session,
    display_name: row?.display_name ?? null,
    image_url: row?.image_url ?? null,
    locale: row?.locale ?? null,
    notification_preference: row?.notification_preference ?? null,
  })
}

export async function save_profile_settings(input: {
  session: Session
  body: unknown
}) {
  const context = normalize_profile_context(input)
  const row = context.user_uuid
    ? await patch_profile_table({
        table: "users",
        key: "user_uuid",
        id: context.user_uuid,
        patch: context.patch,
      })
    : context.visitor_uuid
      ? await patch_profile_table({
          table: "visitors",
          key: "visitor_uuid",
          id: context.visitor_uuid,
          patch: context.patch,
        })
      : null
  let concierge_available: boolean | undefined

  if (typeof context.patch.concierge_available === "boolean") {
    await setConciergeAvailability({
      available: context.patch.concierge_available,
      updated_by: context.user_uuid,
    })
    concierge_available = context.patch.concierge_available
  }

  return build_profile_output({
    session: input.session,
    display_name:
      row?.display_name ??
      ("display_name" in context.patch ? context.patch.display_name : null),
    image_url:
      row?.image_url ?? ("image_url" in context.patch ? context.patch.image_url : null),
    locale: row?.locale ?? context.patch.locale ?? null,
    notification_preference:
      row?.notification_preference ??
      context.patch.notification_preference ??
      null,
    concierge_available,
  })
}
