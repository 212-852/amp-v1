import {
  handleChatRoomPresence,
  resolveRoomPresence,
} from "@/core/chat/action"
import { resolveChatApiSession } from "@/core/chat/api"

export async function GET(request: Request) {
  try {
    const { session } = await resolveChatApiSession()
    const room_uuid = new URL(request.url).searchParams.get("room_uuid")

    if (!room_uuid) {
      return Response.json({ error: "room_uuid is required" }, { status: 400 })
    }

    if (session.role !== "admin") {
      return Response.json({ error: "Admin role required" }, { status: 403 })
    }

    const presence = await resolveRoomPresence(room_uuid)
    return Response.json(presence)
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load room presence",
      },
      { status: 400 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const { context, session } = await resolveChatApiSession()
    const body = (await request.json().catch(() => ({}))) as {
      room_uuid?: string
      action?: "enter" | "leave"
    }

    if (!body.room_uuid) {
      return Response.json({ error: "room_uuid is required" }, { status: 400 })
    }

    if (body.action !== "enter" && body.action !== "leave") {
      return Response.json({ error: "action must be enter or leave" }, { status: 400 })
    }

    const result = await handleChatRoomPresence({
      room_uuid: body.room_uuid,
      action: body.action,
      source_channel: context.source_channel,
      locale: context.locale,
      session,
    })

    return Response.json(result)
  } catch (error) {
    const status =
      error instanceof Error && error.message === "Admin role required"
        ? 403
        : 400

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update room presence",
      },
      { status },
    )
  }
}
