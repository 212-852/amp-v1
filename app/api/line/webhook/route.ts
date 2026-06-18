import { createHmac, timingSafeEqual } from "crypto"

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

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get("x-line-signature")

  if (!verifyLineSignature(body, signature)) {
    return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 })
  }

  let payload: unknown

  try {
    payload = JSON.parse(body) as unknown
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const result = await handleLineWebhook(normalizeLineWebhookRequest(payload)).catch(
    (error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "line_webhook_failed",
    }),
  )

  return Response.json(result, { status: 200 })
}
