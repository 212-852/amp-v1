import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import type { SessionRole } from "@/core/auth/types"

export async function update_user_role_tier(
  user_uuid: string,
  patch: {
    role?: SessionRole
    tier?: string
  },
) {
  const config = getRestConfig()

  if (!config) {
    throw new Error("Database configuration is missing")
  }

  const body: Record<string, string> = {}

  if (patch.role) {
    body.role = patch.role
  }

  if (patch.tier) {
    body.tier = patch.tier
  }

  if (Object.keys(body).length === 0) {
    return
  }

  const response = await fetch(
    restUrl(config, "users", `user_uuid=eq.${encodeURIComponent(user_uuid)}`),
    {
      method: "PATCH",
      headers: restHeaders(config),
      body: JSON.stringify(body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const error = await readRestError(response)

    throw new Error(
      `Failed to update user role/tier: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }
}

export async function apply_driver_registration(user_uuid: string) {
  await update_user_role_tier(user_uuid, {
    role: "driver",
  })
}
