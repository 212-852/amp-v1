import { unstable_rethrow } from "next/navigation"
import { NextResponse } from "next/server"

import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { can_update_driver_progress } from "@/core/driver/progress/rules"
import { run_ocr_action } from "@/ocr/action"
import { build_ocr_result } from "@/ocr/result"

function read_string(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  try {
    const auth = await resolveAuthContext("/driver")
    const session = await resolveSession(auth)
    const access = can_update_driver_progress({
      role: session.role,
      user_uuid: session.user_uuid,
    })

    if (!access.allowed) {
      return NextResponse.json({ ok: false, message: "ドライバー権限が必要です。" }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const request_id = read_string(body.request_id) || crypto.randomUUID()
    const component_instance_id = read_string(body.component_instance_id) || "server"
    const image_base64 = read_string(body.image_base64) || read_string(body.image_url)
    const result = await run_ocr_action({
      document_type: "driver_license_front",
      image_base64,
      provider_preference: "default",
      request_id,
      component_instance_id,
    })

    if (!result.ok) {
      return NextResponse.json({
        ...build_ocr_result(result),
        saved: false,
      }, { status: 422 })
    }

    return NextResponse.json(build_ocr_result(result))
  } catch (error) {
    unstable_rethrow(error)
    return NextResponse.json({
      ok: false,
      saved: false,
      message: error instanceof Error ? error.message : "OCR読み込みに失敗しました。",
    }, { status: 400 })
  }
}
