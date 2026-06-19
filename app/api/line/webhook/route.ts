import { createHmac, timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

import { DEBUG_LINE_WEBHOOK } from "@/core/control"
import { sendAuthDebug } from "@/core/debug"
import { handleLineWebhook } from "@/core/line/action"
import { normalizeLineWebhookRequest } from "@/core/line/context"
import { is_allowed_line_user } from "@/core/line/rules"

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

  return NextResponse.json({ ok: true, route: "line_webhook" })
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
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
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
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 })
  }

  try {
    const line_request = await normalizeLineWebhookRequest(payload)
    const allowed_events = []

    for (const event of line_request.events) {
      if (is_allowed_line_user(event.provider_user_id)) {
        allowed_events.push(event)
        continue
      }

      if (DEBUG_LINE_WEBHOOK) {
        console.info("[line_webhook] line_test_blocked_before_db", {
          provider_user_id: event.provider_user_id,
          source_channel: event.source_channel,
        })
        await sendAuthDebug("line_webhook_ignored_not_allowed", {
          provider_user_id: event.provider_user_id,
          reason: event.provider_user_id
            ? "line_test_mode_not_allowed"
            : "missing_provider_user_id",
          source_channel: event.source_channel,
        })
      }
    }

    if (allowed_events.length === 0) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 })
    }

    const result = await handleLineWebhook({ events: allowed_events })

    await sendAuthDebug("line_webhook_received", {
      event_count: result.results.length,
      ignored_all: false,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    await sendAuthDebug("line_webhook_failed", {
      error_message: error instanceof Error ? error.message : String(error),
    })

    return new Response(null, { status: 200 })
  }
}
