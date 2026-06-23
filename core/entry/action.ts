import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { EntryRequestContext } from "@/core/entry/context"
import {
  build_entry_success_output,
  build_entry_validation_output,
  type EntrySubmitOutput,
} from "@/core/entry/output"
import {
  resolve_entry_redirect_path,
  validate_entry_input,
} from "@/core/entry/rules"

type EntryInsertRow = {
  entry_uuid?: string | null
}

async function archive_entry(context: EntryRequestContext) {
  const config = getRestConfig()

  if (!config) {
    return null
  }

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
        name: context.input.name,
        phone: context.input.phone,
        email: context.input.email,
        prefecture_code: context.input.prefecture_code,
        city_code: context.input.city_code,
        prefecture: context.input.prefecture,
        city: context.input.city,
        address: context.input.address,
        car_owned: context.input.car_owned === "yes",
        license_owned: context.input.license_owned === "yes",
        available_days: context.input.available_days,
        note: context.input.note || null,
        payload: context.input,
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

export async function submit_entry(
  context: EntryRequestContext,
): Promise<EntrySubmitOutput> {
  const validation = validate_entry_input(context.input)

  if (!validation.ok) {
    return build_entry_validation_output(validation)
  }

  const entry_uuid = await archive_entry(context)

  return build_entry_success_output({
    entry_uuid,
    redirect_path: resolve_entry_redirect_path(context.session.role),
  })
}
