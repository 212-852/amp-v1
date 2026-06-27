import { unstable_rethrow } from "next/navigation"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { save_driver_license_progress_from_ocr } from "@/core/driver/progress/action"
import { build_driver_license_ocr_context } from "@/core/driver/progress/context"
import {
  build_driver_license_ocr_output,
  build_driver_progress_access_denied_output,
  build_driver_progress_validation_output,
} from "@/core/driver/progress/output"
import { can_update_driver_progress } from "@/core/driver/progress/rules"
import { ensure_ocr_env_loaded } from "@/core/ocr/env"
import { read_ocr_document_type, validate_ocr_request } from "@/core/ocr/rules"

export async function POST(request: Request) {
  ensure_ocr_env_loaded()

  try {
    const auth = await resolveAuthContext("/driver")
    const session = await resolveSession(auth)
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const context = build_driver_license_ocr_context({
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

    const validation = validate_ocr_request({
      document_type: read_ocr_document_type(context.input.document_type),
      image_url: context.input.image_url,
    })

    if (!validation.ok) {
      const output = build_driver_progress_validation_output(validation)

      return NextResponse.json(output, { status: 400 })
    }

    const result = await save_driver_license_progress_from_ocr(context)
    const output = build_driver_license_ocr_output(result)

    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    unstable_rethrow(error)

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "OCR読み込みに失敗しました。",
      },
      { status: 400 },
    )
  }
}
