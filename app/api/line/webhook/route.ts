import { createHmac, timingSafeEqual } from "crypto"

import { sendAuthDebug } from "@/core/debug"
import { handleLineWebhook } from "@/core/line/action"
import { normalizeLineWebhookRequest } from "@/core/line/context"

function verifyLineSignature(body: string, signature: string | null) {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET

  if (!secret || !signature) {
    return false
  }

  const expected = createHmac("sha256", secret).update(body).digest("base64")
  const signature_buffer = Buffer.from(signature)
  const expected_buffer = Buffer.from(expected)

  return (
    signature_buffer.length === expected_buffer.length &&
    timingSafeEqual(signature_buffer, expected_buffer)
  )
}

export async function GET() {
  await sendAuthDebug("line_webhook_health_check", {
    route: "line_webhook",
  })

  return Response.json({ ok: true, route: "line_webhook" })
}

export async function POST(request: Request) {
  const signature = request.headers.get("x-line-signature")
  const body = await request.text()
  let payload: unknown

  try {
    payload = JSON.parse(body) as unknown
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const signature_ok = verifyLineSignature(body, signature)

  if (!signature_ok) {
    await sendAuthDebug("line_signature_verification_failed", {
      has_signature: Boolean(signature),
      source_channel: "line",
    })
    return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 })
  }

  const result = await normalizeLineWebhookRequest(payload)
    .then((request) => handleLineWebhook(request))
    .catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "line_webhook_failed",
    }))

  return Response.json(result, { status: 200 })
}
