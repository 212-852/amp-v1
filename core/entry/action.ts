import { apply_driver_provisional_registration } from "@/core/auth/role_tier"
import { resolveRequestIdFromHeaders } from "@/core/auth/session"
import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { EntryRequestContext } from "@/core/entry/context"
import {
  build_entry_success_output,
  build_entry_validation_output,
  type EntrySubmitOutput,
} from "@/core/entry/output"
import {
  normalize_pet_experience,
  validate_entry_input,
} from "@/core/entry/rules"
import { save_profile_patch } from "@/core/profile/action"
import { notifyEvent } from "@/core/notify"

type EntryInsertRow = {
  entry_uuid?: string | null
}

type DriverInsertRow = {
  driver_uuid?: string | null
}

async function save_entry_user_email(
  context: EntryRequestContext,
  email: string,
) {
  const config = getRestConfig()

  if (!config || !context.session.user_uuid || !email) {
    return
  }

  const response = await fetch(
    restUrl(
      config,
      "identities",
      [
        `user_uuid=eq.${encodeURIComponent(context.session.user_uuid)}`,
        "provider=eq.email",
      ].join("&"),
    ),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({
        email,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  )

  if (!response.ok && response.status !== 404) {
    const error = await readRestError(response)
    throw new Error(error.message ?? "Failed to save email")
  }
}

async function save_entry_profile(context: EntryRequestContext) {
  const { profile } = context.input

  await save_profile_patch({
    session: context.session,
    patch: {
      last_name: profile.last_name,
      first_name: profile.first_name,
      phone: profile.phone,
      prefecture: profile.prefecture,
      city: profile.city,
      prefecture_code: profile.prefecture_code,
      city_code: profile.city_code,
      address: profile.address,
    },
  })

  if (profile.email) {
    await save_entry_user_email(context, profile.email)
  }
}

async function archive_driver_questionnaire(
  context: EntryRequestContext,
  entry_uuid: string,
) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  if (!context.session.user_uuid) {
    throw new Error("Driver application requires user_uuid")
  }

  const questionnaire = context.input.questionnaire
  const pet_experience = normalize_pet_experience(questionnaire.pet_experience)

  const response = await fetch(
    restUrl(config, "drivers", "select=driver_uuid"),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_uuid: context.session.user_uuid,
        has_driver_license: questionnaire.has_driver_license,
        vehicle_status: questionnaire.vehicle_status,
        freight_operator_status: questionnaire.freight_operator_status,
        safety_manager_status: questionnaire.safety_manager_status,
        pet_experience,
        transport_experience: questionnaire.transport_experience,
        application_reason: questionnaire.application_reason,
        status: "provisional",
        business_notification_ready: false,
        vehicle_ready: false,
        black_plate_ready: false,
        safety_manager_ready: false,
        entry_uuid,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to save driver questionnaire: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as DriverInsertRow[]

  return rows[0]?.driver_uuid ?? null
}

async function archive_entry_record(context: EntryRequestContext) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  const { profile, questionnaire } = context.input
  const display_name = `${profile.last_name}${profile.first_name}`.trim()

  const response = await fetch(
    restUrl(config, "partner_driver_entries", "select=entry_uuid"),
    {
      method: "POST",
      headers: {
        ...restHeaders(config),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_uuid: context.session.user_uuid,
        visitor_uuid: context.session.visitor_uuid,
        line_user_id:
          context.line_identity.line_user_id ??
          context.line_identity.liff_provider_user_id,
        source_channel: context.auth.source_channel,
        status: "provisional",
        name: display_name || null,
        phone: profile.phone,
        email: profile.email,
        prefecture_code: profile.prefecture_code,
        city_code: profile.city_code,
        prefecture: profile.prefecture,
        city: profile.city,
        address: profile.address,
        note: null,
        payload: {
          profile,
          questionnaire: {
            ...questionnaire,
            pet_experience: normalize_pet_experience(questionnaire.pet_experience),
          },
        },
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to save entry: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as EntryInsertRow[]

  return rows[0]?.entry_uuid ?? null
}

async function link_entry_driver(
  entry_uuid: string,
  driver_uuid: string,
) {
  const config = getRestConfig()

  if (!config) {
    return
  }

  await fetch(
    restUrl(
      config,
      "partner_driver_entries",
      `entry_uuid=eq.${encodeURIComponent(entry_uuid)}`,
    ),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify({ driver_uuid }),
      cache: "no-store",
    },
  )
}

async function notify_driver_provisional_registration(
  context: EntryRequestContext,
  input: {
    entry_uuid: string
    driver_uuid: string | null
  },
) {
  const { profile, questionnaire } = context.input
  const display_name = `${profile.last_name}${profile.first_name}`.trim()
  const pet_experience = normalize_pet_experience(questionnaire.pet_experience)
  const request_id = await resolveRequestIdFromHeaders()

  await notifyEvent({
    event: "driver_provisional_registered",
    request_id,
    payload: {
      name: display_name,
      phone: profile.phone,
      prefecture: profile.prefecture,
      city: profile.city,
      vehicle_status: questionnaire.vehicle_status,
      freight_operator_status: questionnaire.freight_operator_status,
      safety_manager_status: questionnaire.safety_manager_status,
      pet_experience: pet_experience.join(", "),
      transport_experience: questionnaire.transport_experience,
      application_reason: questionnaire.application_reason,
      driver_uuid: input.driver_uuid,
      user_uuid: context.session.user_uuid,
      entry_uuid: input.entry_uuid,
    },
  })
}

export async function submit_entry(
  context: EntryRequestContext,
): Promise<EntrySubmitOutput> {
  const validation = validate_entry_input(context.input)

  if (!validation.ok) {
    return build_entry_validation_output(validation)
  }

  await save_entry_profile(context)

  const entry_uuid = await archive_entry_record(context)

  if (!entry_uuid) {
    throw new Error("Failed to create entry record")
  }

  const driver_uuid = await archive_driver_questionnaire(context, entry_uuid)

  if (driver_uuid) {
    await link_entry_driver(entry_uuid, driver_uuid)
  }

  if (context.session.user_uuid) {
    await apply_driver_provisional_registration(context.session.user_uuid)
  }

  await notify_driver_provisional_registration(context, {
    entry_uuid,
    driver_uuid,
  })

  return build_entry_success_output({
    entry_uuid,
    driver_uuid,
  })
}
