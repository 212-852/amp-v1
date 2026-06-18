import { createHmac, timingSafeEqual } from "crypto"

import { sendAuthDebug } from "@/core/debug"
import { handleLineWebhookPayload } from "@/core/line/action"

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
  await sendAuthDebug("line_webhook_route_entered", {
    method: request.method,
    has_signature: Boolean(request.headers.get("x-line-signature")),
    content_type: request.headers.get("content-type"),
  })

  const signature = request.headers.get("x-line-signature")
  const body = await request.text()
  let payload: unknown

  try {
    payload = JSON.parse(body) as unknown
  } catch (error) {
    await sendAuthDebug("line_webhook_invalid_json", {
      error_message: error instanceof Error ? error.message : String(error),
    })
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const signature_ok = verifyLineSignature(body, signature)

  await sendAuthDebug("line_signature_verified", {
    ok: signature_ok,
  })

  if (!signature_ok) {
    await sendAuthDebug("line_signature_verification_failed", {
      has_signature: Boolean(signature),
      source_channel: "line",
    })
    return Response.json({ ok: false, error: "invalid_signature" }, { status: 401 })
  }

  try {
    const result = await handleLineWebhookPayload(payload)

    await sendAuthDebug("line_webhook_received", {
      event_count: result.results.length,
      ignored_all: result.ignored_all,
    })

    if (result.ignored_all) {
      return new Response(null, { status: 200 })
    }

    return Response.json(result, { status: 200 })
  } catch (error) {
    await sendAuthDebug("line_webhook_failed", {
      error_message: error instanceof Error ? error.message : String(error),
    })

    return new Response(null, { status: 200 })
  }
}
