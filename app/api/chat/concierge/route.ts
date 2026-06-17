import {
  getConciergeAvailabilityState,
  toggleConciergeAvailability,
} from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"
import { ConciergeToggleDeniedError } from "@/core/chat/concierge_access"

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
  try {
    const { session } = await resolveChatApiSession()
    const body = (await request.json().catch(() => ({}))) as {
      available?: boolean
    }

    const result = await toggleConciergeAvailability({
      available: Boolean(body.available),
      session,
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
