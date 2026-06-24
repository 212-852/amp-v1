import { apply_driver_registration } from "@/core/auth/role_tier"
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
      prefecture_code: profile.prefecture_code,
      city_code: profile.city_code,
      address: profile.address,
    },
  })

  if (profile.email) {
    await save_entry_user_email(context, profile.email)
  }
}

async function create_driver_record(context: EntryRequestContext) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

  if (!context.session.user_uuid) {
    throw new Error("Driver registration requires user_uuid")
  }

  const questionnaire = context.input.questionnaire
  const pet_experience = normalize_pet_experience(questionnaire.pet_experience)
  const existing = await fetch(
    restUrl(
      config,
      "drivers",
      [
        `user_uuid=eq.${encodeURIComponent(context.session.user_uuid)}`,
        "select=driver_uuid",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (existing.ok) {
    const rows = (await existing.json()) as DriverInsertRow[]

    if (rows[0]?.driver_uuid) {
      const response = await fetch(
        restUrl(
          config,
          "drivers",
          `driver_uuid=eq.${encodeURIComponent(rows[0].driver_uuid)}`,
        ),
        {
          method: "PATCH",
          headers: {
            ...restHeaders(config),
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            has_driver_license: questionnaire.has_driver_license,
            vehicle: questionnaire.vehicle,
            freight_operator: questionnaire.freight_operator,
            safety_manager: questionnaire.safety_manager,
            pet_experience,
            transport_experience: questionnaire.transport_experience,
            application_reason: questionnaire.application_reason,
            status: "provisional",
          }),
          cache: "no-store",
        },
      )

      if (!response.ok) {
        const error = await readRestError(response)

        throw new Error(
          `Failed to update driver record: ${error.code ?? "unknown"} ${
            error.message ?? "No PostgREST error returned"
          }`,
        )
      }

      const updated = (await response.json()) as DriverInsertRow[]

      return updated[0]?.driver_uuid ?? rows[0].driver_uuid
    }
  }

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
        status: "provisional",
        has_driver_license: questionnaire.has_driver_license,
        vehicle: questionnaire.vehicle,
        freight_operator: questionnaire.freight_operator,
        safety_manager: questionnaire.safety_manager,
        pet_experience,
        transport_experience: questionnaire.transport_experience,
        application_reason: questionnaire.application_reason,
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to create driver record: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  const rows = (await response.json()) as DriverInsertRow[]

  return rows[0]?.driver_uuid ?? null
}

async function notify_driver_entry(
  context: EntryRequestContext,
  input: {
    driver_uuid: string | null
  },
) {
  const { profile } = context.input
  const display_name = `${profile.last_name}${profile.first_name}`.trim()
  const request_id = await resolveRequestIdFromHeaders()

  await notifyEvent({
    event: "driver_entry",
    request_id,
    payload: {
      category: "DRIVER_ENTRY",
      name: display_name,
      phone: profile.phone,
      email: profile.email,
      user_uuid: context.session.user_uuid,
      driver_uuid: input.driver_uuid,
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

  const driver_uuid = await create_driver_record(context)

  if (!driver_uuid) {
    throw new Error("Failed to create driver record")
  }

  if (context.session.user_uuid) {
    await apply_driver_registration(context.session.user_uuid)
  }

  await notify_driver_entry(context, { driver_uuid })

  return build_entry_success_output({
    driver_uuid,
  })
}
