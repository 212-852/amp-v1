"use client"

import { useEffect } from "react"

import type { ChatMessageRecord } from "@/core/chat/types"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"

type RoomMessageSubscriptionOptions = {
  enabled?: boolean
  on_insert: (message: ChatMessageRecord) => void
}

function useRoomMessages(
  room_uuid: string | null | undefined,
  options: RoomMessageSubscriptionOptions,
) {
  const { enabled = true, on_insert } = options

  useEffect(() => {
    if (!room_uuid || !enabled) {
      return
    }

    let supabase: ReturnType<typeof create_browser_supabase_client>

    try {
      supabase = create_browser_supabase_client()
    } catch (error) {
      console.info("[chat_realtime] channel_error", {
        room_uuid,
        error_message: error instanceof Error ? error.message : String(error),
      })
      return
    }

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

          if (!message?.message_uuid) {
            console.info("[chat_realtime] realtime_insert_skipped", {
              room_uuid,
              reason: "missing_message_uuid",
            })
            return
          }

          console.info("[chat_realtime] realtime_insert_received", {
            room_uuid,
            message_uuid: message.message_uuid,
          })
          on_insert(message)
        },
      )

    channel.subscribe((status) => {
      if (
        status === "SUBSCRIBED" ||
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT"
      ) {
        console.info("[chat_realtime] subscription_status", {
          room_uuid,
          status,
        })
      }
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, on_insert, room_uuid])
}

export const use_room_messages = useRoomMessages
