import { NextResponse } from "next/server"
import { unstable_rethrow } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { build_driver_preparation_context } from "@/core/driver/context"
import { update_driver_preparation, load_driver_state } from "@/core/driver/action"
import {
  build_driver_preparation_access_denied_output,
  build_driver_preparation_success_output,
  build_driver_preparation_validation_output,
} from "@/core/driver/output"
import {
  can_update_driver_preparation,
  validate_driver_preparation_update,
} from "@/core/driver/rules"

export async function PATCH(request: Request) {
  try {
    const auth = await resolveAuthContext("/driver")
    const session = await resolveSession(auth)
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const context = build_driver_preparation_context({
      auth,
      session,
      body,
    })
    const access = can_update_driver_preparation(context)

    if (!access.allowed) {
      const output = build_driver_preparation_access_denied_output(
        access.reason ?? "driver_role_required",
      )

      return NextResponse.json(output, { status: 403 })
    }

    const validation = validate_driver_preparation_update(context.input)

    if (!validation.ok) {
      const output = build_driver_preparation_validation_output(validation)

      return NextResponse.json(output, { status: 400 })
    }

    const before = await load_driver_state(session.user_uuid)
    const state = await update_driver_preparation(context)
    const output = build_driver_preparation_success_output({
      state,
      previous_status: before.status,
    })

    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    unstable_rethrow(error)

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "更新できませんでした。",
      },
      { status: 400 },
    )
  }
}
