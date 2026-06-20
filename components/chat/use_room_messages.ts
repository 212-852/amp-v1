"use client"

import { useEffect, useRef } from "react"

import {
  getClientMessageId,
  normalizeRealtimeMessage,
} from "@/components/chat/message_merge"
import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"
import type { ChatMessageRecord } from "@/core/chat/types"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"

type RoomMessageSubscriptionOptions = {
  enabled?: boolean
  on_insert: (message: ChatMessageRecord) => void
  view?: "user" | "concierge"
  current_user_uuid?: string | null
  visitor_uuid?: string | null
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
    visitor_uuid = null,
  } = options
  const on_insert_ref = useRef(on_insert)
  const debug_ref = useRef({
    view,
    current_user_uuid,
    visitor_uuid,
  })

  useEffect(() => {
    on_insert_ref.current = on_insert
  }, [on_insert])

  useEffect(() => {
    debug_ref.current = {
      view,
      current_user_uuid,
      visitor_uuid,
    }
  }, [current_user_uuid, view, visitor_uuid])

  useEffect(() => {
    console.log("[chat realtime] room_uuid", {
      room_uuid: room_uuid ?? null,
      enabled,
      receiver_view: view,
      current_user_uuid,
      visitor_uuid,
    })
  }, [current_user_uuid, enabled, room_uuid, view, visitor_uuid])

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
        receiver_view: debug_ref.current.view,
        room_uuid,
        current_user_uuid: debug_ref.current.current_user_uuid,
        visitor_uuid: debug_ref.current.visitor_uuid,
        reason: error instanceof Error ? error.message : String(error),
      })
      return
    }

    console.log("[chat realtime] creating subscription", {
      room_uuid,
      filter: `room_uuid=eq.${room_uuid}`,
      receiver_view: debug_ref.current.view,
      current_user_uuid: debug_ref.current.current_user_uuid,
    })
    if (debug_ref.current.view === "user") {
      send_chat_realtime_debug("user_chat_realtime_subscribe_creating", {
        receiver_view: "user",
        room_uuid,
        current_user_uuid: debug_ref.current.current_user_uuid,
        visitor_uuid: debug_ref.current.visitor_uuid,
      })
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
          const message = normalizeRealtimeMessage(payload.new)
          const client_message_id = getClientMessageId(message)
          const debug_context = debug_ref.current

          console.log("[chat realtime] insert received", {
            insert_room_uuid: message?.room_uuid ?? null,
            current_room_uuid: room_uuid,
            message_uuid: message?.message_uuid ?? null,
            client_message_id,
            sender_uuid: message?.participant_uuid ?? null,
            current_user_uuid: debug_context.current_user_uuid,
            visitor_uuid: debug_context.visitor_uuid,
            receiver_view: debug_context.view,
          })
          send_chat_realtime_debug("chat_realtime_insert_received", {
            receiver_view: debug_context.view,
            room_uuid,
            incoming_room_uuid: message?.room_uuid ?? null,
            message_uuid: message?.message_uuid ?? null,
            client_message_id,
            sender_uuid: message?.participant_uuid ?? null,
            current_user_uuid: debug_context.current_user_uuid,
            visitor_uuid: debug_context.visitor_uuid,
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
              current_user_uuid: debug_context.current_user_uuid,
              visitor_uuid: debug_context.visitor_uuid,
              receiver_view: debug_context.view,
            })
            send_chat_realtime_debug("chat_realtime_insert_room_mismatch", {
              receiver_view: debug_context.view,
              room_uuid,
              incoming_room_uuid: message.room_uuid,
              message_uuid: message.message_uuid,
              client_message_id,
              sender_uuid: message.participant_uuid ?? null,
              current_user_uuid: debug_context.current_user_uuid,
              visitor_uuid: debug_context.visitor_uuid,
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
          receiver_view: debug_ref.current.view,
          current_user_uuid: debug_ref.current.current_user_uuid,
          visitor_uuid: debug_ref.current.visitor_uuid,
        })

        if (status === "SUBSCRIBED") {
          console.log("[chat realtime] subscribed", { room_uuid })
          send_chat_realtime_debug("chat_realtime_subscribed", {
            receiver_view: debug_ref.current.view,
            room_uuid,
            current_user_uuid: debug_ref.current.current_user_uuid,
            visitor_uuid: debug_ref.current.visitor_uuid,
          })
          if (debug_ref.current.view === "user") {
            send_chat_realtime_debug("user_chat_realtime_subscribed", {
              receiver_view: "user",
              room_uuid,
              current_user_uuid: debug_ref.current.current_user_uuid,
              visitor_uuid: debug_ref.current.visitor_uuid,
            })
          }
        }

        if (status === "CHANNEL_ERROR") {
          console.log("[chat realtime] channel error", { room_uuid })
          send_chat_realtime_debug("chat_realtime_channel_error", {
            receiver_view: debug_ref.current.view,
            room_uuid,
            current_user_uuid: debug_ref.current.current_user_uuid,
            visitor_uuid: debug_ref.current.visitor_uuid,
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
  }, [enabled, room_uuid])
}

export const use_room_messages = useRoomMessages
