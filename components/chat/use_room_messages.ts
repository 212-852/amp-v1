"use client"

import { useEffect, useRef } from "react"

import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"
import type { ChatMessageRecord } from "@/core/chat/types"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"

type RoomMessageSubscriptionOptions = {
  enabled?: boolean
  on_insert: (message: ChatMessageRecord) => void
  view?: "user" | "concierge"
  current_user_uuid?: string | null
}

function getClientMessageId(message: ChatMessageRecord | null) {
  const meta = message?.payload?.meta
  const client_message_id = meta?.client_message_id

  return typeof client_message_id === "string" && client_message_id.trim()
    ? client_message_id.trim()
    : null
}

function useRoomMessages(
  room_uuid: string | null | undefined,
  options: RoomMessageSubscriptionOptions,
) {
  const {
    enabled = true,
    on_insert,
    view = "user",
    current_user_uuid = null,
  } = options
  const on_insert_ref = useRef(on_insert)

  useEffect(() => {
    on_insert_ref.current = on_insert
  }, [on_insert])

  useEffect(() => {
    console.log("[chat realtime] room_uuid", {
      room_uuid: room_uuid ?? null,
      enabled,
      view,
      current_user_uuid,
    })
  }, [current_user_uuid, enabled, room_uuid, view])

  useEffect(() => {
    if (!room_uuid) {
      console.log("[chat realtime] status", {
        room_uuid: null,
        status: "SKIPPED",
        reason: "missing_room_uuid",
      })
      return
    }

    if (!enabled) {
      console.log("[chat realtime] status", {
        room_uuid,
        status: "SKIPPED",
        reason: "disabled",
      })
      return
    }

    let supabase: ReturnType<typeof create_browser_supabase_client>

    try {
      supabase = create_browser_supabase_client()
    } catch (error) {
      console.log("[chat realtime] status", {
        room_uuid,
        status: "CHANNEL_ERROR",
        error_message: error instanceof Error ? error.message : String(error),
      })
      send_chat_realtime_debug("chat_realtime_channel_error", {
        view,
        room_uuid,
        current_user_uuid,
        reason: error instanceof Error ? error.message : String(error),
      })
      return
    }

    console.log("[chat realtime] creating subscription", {
      room_uuid,
      filter: `room_uuid=eq.${room_uuid}`,
      view,
      current_user_uuid,
    })

    const channel = supabase
      .channel(`room_messages:${room_uuid}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_uuid=eq.${room_uuid}`,
        },
        (payload) => {
          const message = payload.new as ChatMessageRecord | null
          const client_message_id = getClientMessageId(message)

          console.log("[chat realtime] insert received", {
            insert_room_uuid: message?.room_uuid ?? null,
            current_room_uuid: room_uuid,
            message_uuid: message?.message_uuid ?? null,
            client_message_id,
            sender_uuid: message?.participant_uuid ?? null,
            current_user_uuid,
            view,
          })
          send_chat_realtime_debug("chat_realtime_insert_received", {
            view,
            room_uuid,
            incoming_room_uuid: message?.room_uuid ?? null,
            message_uuid: message?.message_uuid ?? null,
            client_message_id,
            sender_uuid: message?.participant_uuid ?? null,
            current_user_uuid,
          })

          if (!message?.message_uuid) {
            console.log("[chat realtime] status", {
              room_uuid,
              status: "SKIPPED",
              reason: "missing_message_uuid",
            })
            return
          }

          if (message.room_uuid !== room_uuid) {
            console.log("[chat realtime] room mismatch", {
              insert_room_uuid: message.room_uuid,
              current_room_uuid: room_uuid,
              message_uuid: message.message_uuid,
              client_message_id,
              sender_uuid: message.participant_uuid ?? null,
              current_user_uuid,
              view,
            })
            return
          }

          on_insert_ref.current(message)
        },
      )

    channel.subscribe((status) => {
      if (
        status === "SUBSCRIBED" ||
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
          console.log("[chat realtime] status", {
            room_uuid,
            status,
            view,
            current_user_uuid,
          })

          if (status === "SUBSCRIBED") {
            console.log("[chat realtime] subscribed", { room_uuid })
            send_chat_realtime_debug("chat_realtime_subscribed", {
              view,
              room_uuid,
              current_user_uuid,
            })
          }

          if (status === "CHANNEL_ERROR") {
            console.log("[chat realtime] channel error", { room_uuid })
            send_chat_realtime_debug("chat_realtime_channel_error", {
              view,
              room_uuid,
              current_user_uuid,
              reason: "channel_error",
            })
          }

        if (status === "TIMED_OUT") {
          console.log("[chat realtime] timed out", { room_uuid })
        }
      }
    })

    return () => {
      console.log("[chat realtime] status", {
        room_uuid,
        status: "CLEANUP",
      })
      void supabase.removeChannel(channel)
    }
  }, [current_user_uuid, enabled, room_uuid, view])
}

export const use_room_messages = useRoomMessages
