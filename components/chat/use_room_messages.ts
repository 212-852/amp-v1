"use client"

import { useEffect, useRef } from "react"

import {
  getClientMessageId,
  normalizeRealtimeMessage,
} from "@/components/chat/message_merge"
import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"
import { roomChannelName } from "@/core/chat/room_channel"
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
  const room_uuid_ref = useRef(room_uuid)
  const debug_ref = useRef({
    view,
    current_user_uuid,
    visitor_uuid,
  })

  useEffect(() => {
    on_insert_ref.current = on_insert
  }, [on_insert])

  useEffect(() => {
    room_uuid_ref.current = room_uuid
  }, [room_uuid])

  useEffect(() => {
    debug_ref.current = {
      view,
      current_user_uuid,
      visitor_uuid,
    }
  }, [current_user_uuid, view, visitor_uuid])

  useEffect(() => {
    if (!room_uuid) {
      rejectPayload("missing_room_uuid", debug_ref.current, room_uuid ?? "")
      return
    }

    if (!enabled) {
      rejectPayload("disabled", debug_ref.current, room_uuid)
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
    const broadcast_channel_name = roomChannelName(room_uuid)
    const current_room_uuid = room_uuid

    send_chat_realtime_debug("chat_realtime_subscribe_start", {
      receiver_view: debug_context.view,
      room_uuid: current_room_uuid,
      current_user_uuid: debug_context.current_user_uuid,
      visitor_uuid: debug_context.visitor_uuid,
      channel_name,
      broadcast_channel_name,
    })

    send_chat_realtime_debug("chat_realtime_subscription_details", {
      receiver_view: debug_context.view,
      room_uuid: current_room_uuid,
      current_user_uuid: debug_context.current_user_uuid,
      visitor_uuid: debug_context.visitor_uuid,
      channel_name,
      broadcast_channel_name,
      schema: "public",
      table: "messages",
      event: "INSERT",
      filter: null,
      filter_mode: "client_side_room_match",
    })

    if (debug_context.view === "user") {
      send_chat_realtime_debug("user_chat_realtime_subscribe_creating", {
        receiver_view: "user",
        room_uuid: current_room_uuid,
        current_user_uuid: debug_context.current_user_uuid,
        visitor_uuid: debug_context.visitor_uuid,
        channel_name,
      })
    }

    function deliverMessage(
      raw_record: unknown,
      delivery_source: "postgres" | "broadcast",
      eventType?: string,
    ) {
      const debug_context = debug_ref.current
      const subscribed_room_uuid = room_uuid_ref.current ?? current_room_uuid
      const payload_new =
        delivery_source === "postgres"
          ? readPayloadNewRecord(raw_record)
          : (raw_record as Record<string, unknown> | null)

      send_chat_realtime_debug("chat_realtime_raw_event_received", {
        receiver_view: debug_context.view,
        room_uuid: subscribed_room_uuid,
        delivery_source,
        eventType: eventType ?? (delivery_source === "broadcast" ? "INSERT" : null),
        schema: delivery_source === "postgres" ? "public" : null,
        table: "messages",
        incoming_room_uuid:
          typeof payload_new?.room_uuid === "string" ? payload_new.room_uuid : null,
        message_uuid:
          typeof payload_new?.message_uuid === "string"
            ? payload_new.message_uuid
            : null,
        payload_new,
      })

      if (!payload_new) {
        rejectPayload("missing_payload_new", debug_context, subscribed_room_uuid, {
          delivery_source,
          eventType,
        })
        return
      }

      const incoming_room_uuid =
        typeof payload_new.room_uuid === "string" ? payload_new.room_uuid : null

      if (!incoming_room_uuid) {
        rejectPayload(
          "missing_room_uuid_in_payload",
          debug_context,
          subscribed_room_uuid,
          { delivery_source, eventType, payload_new },
        )
        return
      }

      if (incoming_room_uuid !== subscribed_room_uuid) {
        rejectPayload("room_filter_client_mismatch", debug_context, subscribed_room_uuid, {
          delivery_source,
          incoming_room_uuid,
          eventType,
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
        rejectPayload("normalize_failed", debug_context, subscribed_room_uuid, {
          delivery_source,
          eventType,
          payload_new,
        })
        return
      }

      if (!message.message_uuid) {
        rejectPayload("missing_message_uuid", debug_context, subscribed_room_uuid, {
          delivery_source,
          eventType,
          incoming_room_uuid,
          client_message_id,
          sender_uuid: message.participant_uuid ?? null,
          payload_new,
        })
        return
      }

      send_chat_realtime_debug("chat_realtime_insert_received", {
        receiver_view: debug_context.view,
        room_uuid: subscribed_room_uuid,
        delivery_source,
        eventType,
        message_uuid: message.message_uuid,
        incoming_room_uuid,
        client_message_id,
        sender_uuid: message.participant_uuid ?? null,
        current_user_uuid: debug_context.current_user_uuid,
        visitor_uuid: debug_context.visitor_uuid,
      })

      send_chat_realtime_debug("chat_realtime_filter_pass", {
        receiver_view: debug_context.view,
        room_uuid: subscribed_room_uuid,
        incoming_room_uuid,
        message_uuid: message.message_uuid,
        client_message_id,
        sender_uuid: message.participant_uuid ?? null,
        delivery_source,
        current_user_uuid: debug_context.current_user_uuid,
        visitor_uuid: debug_context.visitor_uuid,
      })

      on_insert_ref.current(message)
    }

    const postgres_channel = supabase
      .channel(channel_name)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          deliverMessage(payload, "postgres", payload.eventType)
        },
      )
      .subscribe((status) => {
        if (
          status === "SUBSCRIBED" ||
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT"
        ) {
          if (status === "SUBSCRIBED") {
            send_chat_realtime_debug("chat_realtime_subscribed", {
              receiver_view: debug_ref.current.view,
              room_uuid: current_room_uuid,
              current_user_uuid: debug_ref.current.current_user_uuid,
              visitor_uuid: debug_ref.current.visitor_uuid,
              channel_name,
              delivery_source: "postgres",
            })
            if (debug_ref.current.view === "user") {
              send_chat_realtime_debug("user_chat_realtime_subscribed", {
                receiver_view: "user",
                room_uuid: current_room_uuid,
                current_user_uuid: debug_ref.current.current_user_uuid,
                visitor_uuid: debug_ref.current.visitor_uuid,
                channel_name,
              })
            }
          }

          if (status === "CHANNEL_ERROR") {
            rejectPayload("channel_error", debug_ref.current, current_room_uuid, {
              channel_name,
              delivery_source: "postgres",
            })
            send_chat_realtime_debug("chat_realtime_channel_error", {
              receiver_view: debug_ref.current.view,
              room_uuid: current_room_uuid,
              current_user_uuid: debug_ref.current.current_user_uuid,
              visitor_uuid: debug_ref.current.visitor_uuid,
              reason: "channel_error",
              channel_name,
            })
          }
        }
      })

    const broadcast_channel = supabase
      .channel(broadcast_channel_name, {
        config: {
          broadcast: {
            self: false,
          },
        },
      })
      .on("broadcast", { event: "message_insert" }, ({ payload }) => {
        deliverMessage(payload, "broadcast", "INSERT")
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          send_chat_realtime_debug("chat_realtime_subscribed", {
            receiver_view: debug_ref.current.view,
            room_uuid: current_room_uuid,
            current_user_uuid: debug_ref.current.current_user_uuid,
            visitor_uuid: debug_ref.current.visitor_uuid,
            channel_name: broadcast_channel_name,
            delivery_source: "broadcast",
          })
        }
      })

    return () => {
      void supabase.removeChannel(postgres_channel)
      void supabase.removeChannel(broadcast_channel)
    }
  }, [enabled, room_uuid])
}

export const use_room_messages = useRoomMessages
