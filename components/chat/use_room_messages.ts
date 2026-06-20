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

const INSERT_SUBSCRIPTION = {
  event: "INSERT" as const,
  schema: "public",
  table: "messages",
}

function readPayloadNewRecord(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null
  }

  const record = (payload as { new?: unknown }).new

  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return null
  }

  return record as Record<string, unknown>
}

function rejectPayload(
  reason: string,
  debug_context: {
    view: "user" | "concierge"
    current_user_uuid: string | null
    visitor_uuid: string | null
  },
  room_uuid: string,
  extra: Record<string, unknown> = {},
) {
  send_chat_realtime_debug("chat_realtime_payload_rejected", {
    receiver_view: debug_context.view,
    room_uuid,
    current_user_uuid: debug_context.current_user_uuid,
    visitor_uuid: debug_context.visitor_uuid,
    reason,
    ...extra,
  })
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
      rejectPayload("missing_room_uuid", debug_ref.current, room_uuid ?? "")
      console.log("[chat realtime] status", {
        room_uuid: null,
        status: "SKIPPED",
        reason: "missing_room_uuid",
      })
      return
    }

    if (!enabled) {
      rejectPayload("disabled", debug_ref.current, room_uuid)
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
      const reason = error instanceof Error ? error.message : String(error)
      rejectPayload("supabase_client_init_failed", debug_ref.current, room_uuid, {
        error_message: reason,
      })
      console.log("[chat realtime] status", {
        room_uuid,
        status: "CHANNEL_ERROR",
        error_message: reason,
      })
      send_chat_realtime_debug("chat_realtime_channel_error", {
        receiver_view: debug_ref.current.view,
        room_uuid,
        current_user_uuid: debug_ref.current.current_user_uuid,
        visitor_uuid: debug_ref.current.visitor_uuid,
        reason,
      })
      return
    }

    const debug_context = debug_ref.current
    const channel_name = `room_messages:${room_uuid}:${debug_context.view}`
    const server_filter = `room_uuid=eq.${room_uuid}`

    send_chat_realtime_debug("chat_realtime_subscribe_start", {
      receiver_view: debug_context.view,
      room_uuid,
      current_user_uuid: debug_context.current_user_uuid,
      visitor_uuid: debug_context.visitor_uuid,
      channel_name,
    })

    send_chat_realtime_debug("chat_realtime_subscription_details", {
      receiver_view: debug_context.view,
      room_uuid,
      current_user_uuid: debug_context.current_user_uuid,
      visitor_uuid: debug_context.visitor_uuid,
      channel_name,
      schema: INSERT_SUBSCRIPTION.schema,
      table: INSERT_SUBSCRIPTION.table,
      event: INSERT_SUBSCRIPTION.event,
      filter: server_filter,
      filter_mode: "client_side_room_match",
    })

    console.log("[chat realtime] creating subscription", {
      room_uuid,
      channel_name,
      filter: server_filter,
      receiver_view: debug_context.view,
      current_user_uuid: debug_context.current_user_uuid,
    })

    if (debug_context.view === "user") {
      send_chat_realtime_debug("user_chat_realtime_subscribe_creating", {
        receiver_view: "user",
        room_uuid,
        current_user_uuid: debug_context.current_user_uuid,
        visitor_uuid: debug_context.visitor_uuid,
        channel_name,
      })
    }

    const channel = supabase
      .channel(channel_name)
      .on("postgres_changes", INSERT_SUBSCRIPTION, (payload) => {
        const debug_context = debug_ref.current
        const payload_new = readPayloadNewRecord(payload)

        send_chat_realtime_debug("chat_realtime_insert_received", {
          receiver_view: debug_context.view,
          room_uuid,
          eventType: payload.eventType,
          message_uuid:
            typeof payload_new?.message_uuid === "string"
              ? payload_new.message_uuid
              : null,
          incoming_room_uuid:
            typeof payload_new?.room_uuid === "string"
              ? payload_new.room_uuid
              : null,
          sender_uuid:
            typeof payload_new?.participant_uuid === "string"
              ? payload_new.participant_uuid
              : null,
          payload_new,
        })

        if (!payload_new) {
          rejectPayload("missing_payload_new", debug_context, room_uuid, {
            eventType: payload.eventType,
          })
          return
        }

        const incoming_room_uuid =
          typeof payload_new.room_uuid === "string"
            ? payload_new.room_uuid
            : null

        if (!incoming_room_uuid) {
          rejectPayload("missing_room_uuid_in_payload", debug_context, room_uuid, {
            eventType: payload.eventType,
            payload_new,
          })
          return
        }

        if (incoming_room_uuid !== room_uuid) {
          rejectPayload("room_filter_client_mismatch", debug_context, room_uuid, {
            incoming_room_uuid,
            eventType: payload.eventType,
            message_uuid:
              typeof payload_new.message_uuid === "string"
                ? payload_new.message_uuid
                : null,
            sender_uuid:
              typeof payload_new.participant_uuid === "string"
                ? payload_new.participant_uuid
                : null,
          })
          return
        }

        const message = normalizeRealtimeMessage(payload_new)
        const client_message_id = getClientMessageId(message)

        if (!message) {
          rejectPayload("normalize_failed", debug_context, room_uuid, {
            eventType: payload.eventType,
            payload_new,
          })
          return
        }

        if (!message.message_uuid) {
          rejectPayload("missing_message_uuid", debug_context, room_uuid, {
            eventType: payload.eventType,
            incoming_room_uuid,
            client_message_id,
            sender_uuid: message.participant_uuid ?? null,
            payload_new,
          })
          return
        }

        send_chat_realtime_debug("chat_realtime_filter_pass", {
          receiver_view: debug_context.view,
          room_uuid,
          incoming_room_uuid,
          message_uuid: message.message_uuid,
          client_message_id,
          sender_uuid: message.participant_uuid ?? null,
          current_user_uuid: debug_context.current_user_uuid,
          visitor_uuid: debug_context.visitor_uuid,
        })

        console.log("[chat realtime] insert received", {
          insert_room_uuid: message.room_uuid,
          current_room_uuid: room_uuid,
          message_uuid: message.message_uuid,
          client_message_id,
          sender_uuid: message.participant_uuid ?? null,
          current_user_uuid: debug_context.current_user_uuid,
          visitor_uuid: debug_context.visitor_uuid,
          receiver_view: debug_context.view,
        })

        on_insert_ref.current(message)
      })

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
            channel_name,
          })
          if (debug_ref.current.view === "user") {
            send_chat_realtime_debug("user_chat_realtime_subscribed", {
              receiver_view: "user",
              room_uuid,
              current_user_uuid: debug_ref.current.current_user_uuid,
              visitor_uuid: debug_ref.current.visitor_uuid,
              channel_name,
            })
          }
        }

        if (status === "CHANNEL_ERROR") {
          rejectPayload("channel_error", debug_ref.current, room_uuid)
          console.log("[chat realtime] channel error", { room_uuid })
          send_chat_realtime_debug("chat_realtime_channel_error", {
            receiver_view: debug_ref.current.view,
            room_uuid,
            current_user_uuid: debug_ref.current.current_user_uuid,
            visitor_uuid: debug_ref.current.visitor_uuid,
            reason: "channel_error",
            channel_name,
          })
        }

        if (status === "TIMED_OUT") {
          rejectPayload("channel_timed_out", debug_ref.current, room_uuid, {
            channel_name,
          })
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
