import {
  getConciergeAvailabilityState,
  toggleConciergeAvailability,
} from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"
import { ConciergeToggleDeniedError } from "@/core/chat/concierge_access"

function parseToggleBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false as const,
      error: "Request body must be a JSON object",
    }
  }

  const enabled = (body as { enabled?: unknown }).enabled

  if (enabled === null || enabled === undefined) {
    return {
      ok: false as const,
      error: "enabled is required",
    }
  }

  if (typeof enabled !== "boolean") {
    return {
      ok: false as const,
      error: "enabled must be a boolean",
    }
  }

  return {
    ok: true as const,
    enabled,
    request_body: body as Record<string, unknown>,
  }
}

export async function GET() {
  try {
    const state = await getConciergeAvailabilityState()
    return Response.json(state)
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load concierge availability",
      },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
  let request_body: unknown = null

  try {
    request_body = await request.json()
  } catch {
    console.info("[concierge_toggle] concierge_toggle_failed", {
      reason: "invalid_json",
      request_body: null,
    })

    return Response.json(
      {
        error: "Invalid JSON body",
      },
      { status: 400 },
    )
  }

  const parsed = parseToggleBody(request_body)

  if (!parsed.ok) {
    console.info("[concierge_toggle] concierge_toggle_failed", {
      reason: "invalid_body",
      request_body,
      error: parsed.error,
    })

    return Response.json(
      {
        error: parsed.error,
      },
      { status: 400 },
    )
  }

  try {
    const { session } = await resolveChatApiSession()

    const result = await toggleConciergeAvailability({
      enabled: parsed.enabled,
      session,
      request_body: parsed.request_body,
    })

    return Response.json(result)
  } catch (error) {
    if (error instanceof ConciergeToggleDeniedError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: 403 },
      )
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update concierge availability",
      },
      { status: 400 },
    )
  }
}
