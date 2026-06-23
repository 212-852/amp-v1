import type { Session } from "@/core/auth/types"
import {
  validate_profile_patch,
  type ProfileSettingsPatch,
} from "@/core/profile/rules"
import { normalize_profile_form_body } from "@/form/normalize"

export type ProfileContext = {
  session: Session
  user_uuid: string | null
  visitor_uuid: string | null
  target: "user" | "visitor"
  patch: ProfileSettingsPatch
}

export function normalize_profile_context(input: {
  session: Session
  body: unknown
}): ProfileContext {
  const body =
    input.body && typeof input.body === "object" && !Array.isArray(input.body)
      ? normalize_profile_form_body(input.body as Record<string, unknown>)
      : {}
  const patch = validate_profile_patch(body, input.session)
  const target = input.session.user_uuid ? "user" : "visitor"

  if (target === "visitor" && !input.session.visitor_uuid) {
    throw new Error("Profile requires a visitor or user session")
  }

  return {
    session: input.session,
    user_uuid: input.session.user_uuid,
    visitor_uuid: input.session.visitor_uuid,
    target,
    patch,
  }
}
