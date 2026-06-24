import { NextResponse } from "next/server"
import { unstable_rethrow } from "next/navigation"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { can_update_driver_progress } from "@/core/driver/progress/rules"
import { run_ocr } from "@/core/ocr/action"
import { build_ocr_context } from "@/core/ocr/context"
import {
  build_ocr_access_denied_output,
  build_ocr_success_output,
  build_ocr_validation_output,
} from "@/core/ocr/output"
import { read_ocr_document_type, validate_ocr_request } from "@/core/ocr/rules"

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthContext("/driver")
    const session = await resolveSession(auth)
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >
    const context = build_ocr_context({
      auth,
      session,
      body,
    })
    const access = can_update_driver_progress({
      role: session.role,
      user_uuid: session.user_uuid,
    })

    if (!access.allowed) {
      const output = build_ocr_access_denied_output(
        access.reason ?? "driver_role_required",
      )

      return NextResponse.json(output, { status: 403 })
    }

    const validation = validate_ocr_request({
      document_type: read_ocr_document_type(context.input.document_type),
      image_url: context.input.image_url,
    })

    if (!validation.ok) {
      const output = build_ocr_validation_output(validation)

      return NextResponse.json(output, { status: 400 })
    }

    const result = await run_ocr(context)
    const output = build_ocr_success_output({
      document_type: result.document_type,
      fields: result.fields,
    })

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
