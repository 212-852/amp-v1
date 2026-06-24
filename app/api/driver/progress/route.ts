import { NextResponse } from "next/server"
import { unstable_rethrow } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { load_driver_progress_state } from "@/core/driver/progress/action"
import { build_driver_progress_context } from "@/core/driver/progress/context"
import { append_driver_progress } from "@/core/driver/progress/action"
import {
  build_driver_progress_access_denied_output,
  build_driver_progress_success_output,
  build_driver_progress_validation_output,
} from "@/core/driver/progress/output"
import {
  can_update_driver_progress,
  validate_progress_append,
} from "@/core/driver/progress/rules"

export async function PATCH(request: Request) {
  try {
    const auth = await resolveAuthContext("/driver")
    const session = await resolveSession(auth)
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const context = build_driver_progress_context({
      auth,
      session,
      body,
    })
    const access = can_update_driver_progress({
      role: session.role,
      user_uuid: session.user_uuid,
    })

    if (!access.allowed) {
      const output = build_driver_progress_access_denied_output(
        access.reason ?? "driver_role_required",
      )

      return NextResponse.json(output, { status: 403 })
    }

    const validation = validate_progress_append(context.input)

    if (!validation.ok) {
      const output = build_driver_progress_validation_output(validation)

      return NextResponse.json(output, { status: 400 })
    }

    const before = await load_driver_progress_state(session.user_uuid)
    const state = await append_driver_progress(context)
    const output = build_driver_progress_success_output({
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
