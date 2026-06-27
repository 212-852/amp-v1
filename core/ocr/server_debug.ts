import { sendAuthDebug } from "@/core/debug"

export async function send_ocr_server_debug(
  event: string,
  payload: Record<string, unknown> = {},
) {
  await sendAuthDebug(event, {
    scope: "ocr_pipeline",
    ...payload,
  })
}
