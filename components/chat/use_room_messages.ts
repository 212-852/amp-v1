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
    console.log("[chat realtime] room_uuid", {
      room_uuid: room_uuid ?? null,
      enabled,
    })
  }, [enabled, room_uuid])

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
      return
    }

    console.log("[chat realtime] creating subscription", {
      room_uuid,
      filter: `room_uuid=eq.${room_uuid}`,
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

          console.log("[chat realtime] insert received", {
            insert_room_uuid: message?.room_uuid ?? null,
            current_room_uuid: room_uuid,
            message_uuid: message?.message_uuid ?? null,
            client_message_id:
              typeof message?.payload === "object" &&
              message.payload &&
              "meta" in message.payload &&
              typeof message.payload.meta === "object" &&
              message.payload.meta &&
              "client_message_id" in message.payload.meta
                ? message.payload.meta.client_message_id
                : null,
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
            })
            return
          }

          on_insert(message)
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
        })

        if (status === "SUBSCRIBED") {
          console.log("[chat realtime] subscribed", { room_uuid })
        }

        if (status === "CHANNEL_ERROR") {
          console.log("[chat realtime] channel error", { room_uuid })
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
  }, [enabled, on_insert, room_uuid])
}

export const use_room_messages = useRoomMessages
