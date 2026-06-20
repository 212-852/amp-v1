"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import ChatMessageBubble from "@/components/chat/message_bubble"
import {
  appendOptimisticMessage,
  mergeArchivedResponse,
  mergeRealtimeInsert,
} from "@/components/chat/message_merge"
import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"
import ChatScrollButton from "@/components/chat/scroll"
import {
  CHAT_BOTTOM_SPACER_HEIGHT,
  is_chat_near_bottom,
  read_chat_scroll_bottom_detail,
  request_chat_scroll_to_bottom,
  type ChatScrollReason,
} from "@/components/chat/scroll_to_bottom"
import { use_room_messages } from "@/components/chat/use_room_messages"
import { useRoomTyping } from "@/components/chat/use_room_typing"
import {
  filterUserVisibleChatMessages,
  readMessageMeta,
  readMessageSourceKind,
  resolveTypingLabel,
} from "@/core/chat/rules"
import { get_display_name } from "@/core/profile/display"
import type { ProfileDisplayPayload } from "@/core/profile/output"
import { create_browser_supabase_client } from "@/src/lib/supabase/client"
import { useLocale } from "@/src/components/locale/provider"
import type {
  ChatMessageRecord,
  MessageBundle,
  ChatRoomMode,
  ChatRoomRecord,
  PresenceView,
} from "@/core/chat/types"
import type { Locale } from "@/src/lib/locale"

const content = {
  bot_mode: {
    ja: "Botモード",
    en: "Bot mode",
    es: "Modo Bot",
  },
}

const DEBUG_REALTIME_DUPLICATES = false

function shouldShowMessageHeader(
  message: ChatMessageRecord,
  previous_message: ChatMessageRecord | null,
) {
  if (!previous_message || message.type === "system") {
    return true
  }

  if (previous_message.type === "system") {
    return true
  }

  return !(
    previous_message.participant_uuid === message.participant_uuid &&
    readMessageSourceKind(previous_message) === readMessageSourceKind(message)
  )
}

function getClientMessageId(message: ChatMessageRecord) {
  const client_message_id = readMessageMeta(message.payload).client_message_id

  return typeof client_message_id === "string" && client_message_id.trim()
    ? client_message_id.trim()
    : null
}

function buildOptimisticMessage(input: {
  room_uuid: string
  participant_uuid: string
  body: string
  client_message_id: string
  source_kind: "user" | "concierge"
  actor_display_name: string | null
  locale: Locale
}): ChatMessageRecord {
  const now = new Date().toISOString()

  return {
    message_uuid: input.client_message_id,
    room_uuid: input.room_uuid,
    participant_uuid: input.participant_uuid,
    type: "text",
    status: "sending",
    body: input.body,
    payload: {
      meta: {
        source_kind: input.source_kind,
        original_locale: input.locale,
        display_locale: input.locale,
        translation_status: "none",
        actor_display_name: input.actor_display_name ?? undefined,
        client_message_id: input.client_message_id,
      },
    },
    created_at: now,
  }
}

function messageBundleToRecord(
  bundle: MessageBundle,
  participant_uuid: string,
): ChatMessageRecord {
  return {
    message_uuid: bundle.message_uuid,
    room_uuid: bundle.room_uuid,
    participant_uuid,
    type: bundle.type,
    status: bundle.status,
    body: bundle.body,
    payload: bundle.payload,
    created_at: bundle.created_at,
  }
}

type ChatRoomPanelProps = {
  initial_room: ChatRoomRecord
  initial_messages: ChatMessageRecord[]
  initial_presence?: PresenceView[]
  participant_uuid: string
  viewer_display_name?: string | null
  room_uuid?: string | null
  show_presence?: boolean
  fill_height?: boolean
  scroll_button_placement?: "panel" | "above_input"
}

export default function ChatRoomPanel({
  initial_room,
  initial_messages,
  initial_presence = [],
  participant_uuid,
  viewer_display_name = null,
  room_uuid = null,
  show_presence = false,
  fill_height = false,
  scroll_button_placement = "panel",
}: Readonly<ChatRoomPanelProps>) {
  const [room, set_room] = useState(initial_room)
  const [messages, set_messages] = useState(initial_messages)
  const [presence, set_presence] = useState(initial_presence)
  const [is_loading_older, set_is_loading_older] = useState(false)
  const [has_older_messages, set_has_older_messages] = useState(
    initial_messages.length >= 30,
  )
  const { locale } = useLocale()
  const [current_viewer_display_name, set_current_viewer_display_name] =
    useState(viewer_display_name)

  useEffect(() => {
    function handle_profile_updated(event: Event) {
      const profile = (event as CustomEvent<ProfileDisplayPayload>).detail
      set_current_viewer_display_name(
        get_display_name(profile, {
          name: viewer_display_name,
          fallback: "Guest",
        }),
      )
    }

    window.addEventListener("amp-profile-updated", handle_profile_updated)

    return () => {
      window.removeEventListener("amp-profile-updated", handle_profile_updated)
    }
  }, [viewer_display_name])
  const typing = useRoomTyping({
    room_uuid: room.room_uuid,
    participant_uuid,
  })
  const bottom_ref = useRef<HTMLDivElement>(null)
  const scroll_ref = useRef<HTMLDivElement>(null)
  const is_near_bottom_ref = useRef(true)
  const pending_scroll_ref = useRef<{
    reason: ChatScrollReason
    force: boolean
  } | null>(null)
  const realtime_debug_context = useMemo(
    () => ({
      view: show_presence ? "concierge" as const : "user" as const,
      current_user_uuid: show_presence ? null : room.user_uuid ?? null,
      visitor_uuid: room.visitor_uuid ?? null,
    }),
    [room.user_uuid, room.visitor_uuid, show_presence],
  )

  const scroll_to_bottom = useCallback(
    (reason: ChatScrollReason, force = false) => {
      request_chat_scroll_to_bottom({
        scroll_container: scroll_ref.current,
        bottom_anchor: bottom_ref.current,
        reason,
        view: realtime_debug_context.view,
        force,
        is_near_bottom: is_near_bottom_ref.current,
      })
    },
    [realtime_debug_context.view],
  )

  const queue_scroll_to_bottom = useCallback(
    (reason: ChatScrollReason, force = false) => {
      pending_scroll_ref.current = { reason, force }
    },
    [],
  )

  useEffect(() => {
    console.log("[chat realtime] room_uuid", {
      room_uuid: room.room_uuid,
      view: show_presence ? "concierge" : "user",
    })
  }, [room.room_uuid, show_presence])

  const refresh = useCallback(async () => {
    const params = new URLSearchParams()

    params.set("locale", locale)

    const scoped_room_uuid = room_uuid ?? (show_presence ? room.room_uuid : null)

    if (scoped_room_uuid) {
      params.set("room_uuid", scoped_room_uuid)
    }

    const query = `?${params.toString()}`
    const response = await fetch(`/api/chat/room${query}`, { cache: "no-store" })

    if (!response.ok) {
      return
    }

    const payload = (await response.json()) as {
      room: ChatRoomRecord | null
      messages: ChatMessageRecord[]
      presence?: PresenceView[]
    }

    if (!payload.room) {
      return
    }

    if (payload.room.mode !== room.mode) {
      window.dispatchEvent(
        new CustomEvent("amp-chat-mode-changed", {
          detail: { mode: payload.room.mode },
        }),
      )
    }

    set_room(payload.room)
    if (payload.presence) {
      set_presence(payload.presence)
    }
  }, [
    locale,
    room.mode,
    room.room_uuid,
    room_uuid,
    show_presence,
  ])

  const handle_room_message_insert = useCallback(
    (next_message: ChatMessageRecord) => {
      if (next_message.room_uuid !== room.room_uuid) {
        send_chat_realtime_debug("chat_realtime_payload_rejected", {
          receiver_view: realtime_debug_context.view,
          room_uuid: room.room_uuid,
          incoming_room_uuid: next_message.room_uuid,
          message_uuid: next_message.message_uuid,
          client_message_id: getClientMessageId(next_message),
          sender_uuid: next_message.participant_uuid ?? null,
          current_user_uuid: realtime_debug_context.current_user_uuid,
          visitor_uuid: realtime_debug_context.visitor_uuid ?? null,
          reason: "panel_room_mismatch",
        })
        send_chat_realtime_debug("chat_realtime_insert_room_mismatch", {
          receiver_view: realtime_debug_context.view,
          room_uuid: room.room_uuid,
          incoming_room_uuid: next_message.room_uuid,
          message_uuid: next_message.message_uuid,
          client_message_id: getClientMessageId(next_message),
          sender_uuid: next_message.participant_uuid ?? null,
          current_user_uuid: realtime_debug_context.current_user_uuid,
          visitor_uuid: realtime_debug_context.visitor_uuid ?? null,
        })
        return
      }

      let should_scroll_realtime = false

      set_messages((current) => {
        const result = mergeRealtimeInsert(current, next_message)

        if (result.action === "duplicate_replaced") {
          if (DEBUG_REALTIME_DUPLICATES) {
            console.log("[chat realtime] duplicate skipped", {
              room_uuid: next_message.room_uuid,
              message_uuid: result.incoming_message_uuid,
              client_message_id: result.incoming_client_message_id,
              sender_uuid: result.sender_uuid,
              receiver_view: realtime_debug_context.view,
            })
          }
          send_chat_realtime_debug("chat_realtime_insert_duplicate_skipped", {
            receiver_view: realtime_debug_context.view,
            room_uuid: room.room_uuid,
            incoming_room_uuid: next_message.room_uuid,
            message_uuid: result.incoming_message_uuid,
            client_message_id: result.incoming_client_message_id,
            sender_uuid: result.sender_uuid,
            current_user_uuid: realtime_debug_context.current_user_uuid,
            visitor_uuid: realtime_debug_context.visitor_uuid ?? null,
          })
        }

        if (result.action === "appended") {
          const rendered_count = show_presence
            ? result.messages.length
            : filterUserVisibleChatMessages(result.messages).length

          if (is_near_bottom_ref.current) {
            should_scroll_realtime = true
          }

          console.log("[chat realtime] append message", {
            room_uuid: next_message.room_uuid,
            message_uuid: result.incoming_message_uuid,
            client_message_id: result.incoming_client_message_id,
            sender_uuid: result.sender_uuid,
            receiver_view: realtime_debug_context.view,
            rendered_count,
          })
          send_chat_realtime_debug("chat_realtime_insert_append_done", {
            receiver_view: realtime_debug_context.view,
            room_uuid: room.room_uuid,
            incoming_room_uuid: next_message.room_uuid,
            message_uuid: result.incoming_message_uuid,
            client_message_id: result.incoming_client_message_id,
            sender_uuid: result.sender_uuid,
            current_user_uuid: realtime_debug_context.current_user_uuid,
            visitor_uuid: realtime_debug_context.visitor_uuid ?? null,
            rendered_count,
          })
          send_chat_realtime_debug("chat_realtime_render_done", {
            receiver_view: realtime_debug_context.view,
            room_uuid: room.room_uuid,
            message_uuid: result.incoming_message_uuid,
            client_message_id: result.incoming_client_message_id,
            sender_uuid: result.sender_uuid,
            rendered_count,
          })
        }

        return result.messages
      })

      if (should_scroll_realtime) {
        queue_scroll_to_bottom("realtime_receive", false)
      }

      window.dispatchEvent(new CustomEvent("amp-admin-queue-refresh"))
    },
    [queue_scroll_to_bottom, realtime_debug_context, room.room_uuid, show_presence],
  )

  use_room_messages(room.room_uuid, {
    on_insert: handle_room_message_insert,
    view: realtime_debug_context.view,
    current_user_uuid: realtime_debug_context.current_user_uuid,
    visitor_uuid: room.visitor_uuid ?? null,
  })

  useEffect(() => {
    let supabase: ReturnType<typeof create_browser_supabase_client>

    try {
      supabase = create_browser_supabase_client()
    } catch {
      return
    }

    const channel = supabase
      .channel(`chat_room_panel:${room.room_uuid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `room_uuid=eq.${room.room_uuid}`,
        },
        (payload) => {
          set_room((current) => ({
            ...current,
            ...(payload.new as Partial<ChatRoomRecord>),
          }))
        },
      )

    if (show_presence) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presence",
          filter: `room_uuid=eq.${room.room_uuid}`,
        },
        () => {
          void refresh()
        },
      )
    }

    channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [refresh, room.room_uuid, show_presence])

  useEffect(() => {
    is_near_bottom_ref.current = true
    queue_scroll_to_bottom("room_change", true)
  }, [room.room_uuid, queue_scroll_to_bottom])

  useEffect(() => {
    is_near_bottom_ref.current = true
    queue_scroll_to_bottom("initial_load", true)
  }, [queue_scroll_to_bottom])

  useEffect(() => {
    function handle_scroll_bottom(event: Event) {
      const detail = read_chat_scroll_bottom_detail(event)
      is_near_bottom_ref.current = true
      scroll_to_bottom(detail.reason ?? "manual_jump", detail.force ?? true)
    }

    function handle_input_resized(event: Event) {
      const detail = (event as CustomEvent<{ reason?: string }>).detail
      const reason =
        detail?.reason === "composer_mount"
          ? "composer_mount"
          : detail?.reason === "composer_resize"
            ? "composer_resize"
            : "input_resize"

      if (is_near_bottom_ref.current) {
        scroll_to_bottom(reason, false)
      }
    }

    window.addEventListener("amp-chat-scroll-bottom", handle_scroll_bottom)
    window.addEventListener("amp-chat-input-resized", handle_input_resized)
    window.addEventListener("amp-chat-composer-mounted", handle_input_resized)

    return () => {
      window.removeEventListener("amp-chat-scroll-bottom", handle_scroll_bottom)
      window.removeEventListener("amp-chat-input-resized", handle_input_resized)
      window.removeEventListener("amp-chat-composer-mounted", handle_input_resized)
    }
  }, [scroll_to_bottom])

  useEffect(() => {
    function handle_mode_change(event: Event) {
      const detail = (event as CustomEvent<{ mode: ChatRoomMode }>).detail

      if (!detail?.mode) {
        return
      }

      let mode_changed = false

      set_room((current) => {
        if (current.mode === detail.mode) {
          return current
        }

        mode_changed = true
        return { ...current, mode: detail.mode }
      })

      if (mode_changed) {
        void refresh()
      }
    }

    window.addEventListener("amp-chat-mode-changed", handle_mode_change)

    return () => {
      window.removeEventListener("amp-chat-mode-changed", handle_mode_change)
    }
  }, [refresh])

  useEffect(() => {
    function handle_message_created() {
      window.dispatchEvent(new CustomEvent("amp-admin-queue-refresh"))
    }

    window.addEventListener("amp-chat-message-created", handle_message_created)

    return () => {
      window.removeEventListener(
        "amp-chat-message-created",
        handle_message_created,
      )
    }
  }, [refresh])

  useEffect(() => {
    function handle_optimistic_message(event: Event) {
      const detail = (event as CustomEvent<{
        room_uuid?: string | null
        participant_uuid?: string | null
        body?: string
        client_message_id?: string
      }>).detail

      if (
        detail?.participant_uuid &&
        detail.participant_uuid !== participant_uuid
      ) {
        return
      }

      if (
        detail?.room_uuid &&
        detail.room_uuid !== room.room_uuid
      ) {
        return
      }

      if (!detail?.body || !detail.client_message_id) {
        return
      }

      const body = detail.body
      const client_message_id = detail.client_message_id
      is_near_bottom_ref.current = true
      queue_scroll_to_bottom("own_send", true)

      set_messages((current) => {
        const optimistic_message = buildOptimisticMessage({
          room_uuid: room.room_uuid,
          participant_uuid,
          body,
          client_message_id,
          source_kind: show_presence ? "concierge" : "user",
          actor_display_name: current_viewer_display_name,
          locale: (room.locale as Locale) ?? "ja",
        })
        const result = appendOptimisticMessage(current, optimistic_message)

        if (result.action === "appended") {
          send_chat_realtime_debug("chat_optimistic_append_done", {
            view: realtime_debug_context.view,
            room_uuid: room.room_uuid,
            client_message_id,
            sender_uuid: participant_uuid,
            message_uuid: optimistic_message.message_uuid,
          })
        }

        return result.messages
      })
    }

    window.addEventListener("amp-chat-optimistic-message", handle_optimistic_message)

    return () => {
      window.removeEventListener(
        "amp-chat-optimistic-message",
        handle_optimistic_message,
      )
    }
  }, [
    current_viewer_display_name,
    participant_uuid,
    queue_scroll_to_bottom,
    room.locale,
    room.room_uuid,
    realtime_debug_context,
    show_presence,
  ])

  useEffect(() => {
    function handle_archived_message(event: Event) {
      const detail = (event as CustomEvent<{
        room_uuid?: string | null
        message?: MessageBundle
      }>).detail

      if (!detail?.message) {
        return
      }

      if (
        detail.room_uuid &&
        detail.room_uuid !== room.room_uuid
      ) {
        return
      }

      set_messages((current) =>
        mergeArchivedResponse(
          current,
          messageBundleToRecord(detail.message as MessageBundle, participant_uuid),
        ).messages,
      )

      if (is_near_bottom_ref.current) {
        queue_scroll_to_bottom("message_archived", false)
      }
    }

    window.addEventListener("amp-chat-message-archived", handle_archived_message)

    return () => {
      window.removeEventListener(
        "amp-chat-message-archived",
        handle_archived_message,
      )
    }
  }, [participant_uuid, queue_scroll_to_bottom, room.room_uuid])

  useEffect(() => {
    function handle_failed_message(event: Event) {
      const detail = (event as CustomEvent<{
        client_message_id?: string
      }>).detail

      if (!detail?.client_message_id) {
        return
      }

      set_messages((current) =>
        current.map((message) =>
          getClientMessageId(message) === detail.client_message_id
            ? { ...message, status: "failed" }
            : message,
        ),
      )
    }

    window.addEventListener("amp-chat-message-failed", handle_failed_message)

    return () => {
      window.removeEventListener("amp-chat-message-failed", handle_failed_message)
    }
  }, [])

  useEffect(() => {
    if (pending_scroll_ref.current) {
      const { reason, force } = pending_scroll_ref.current
      pending_scroll_ref.current = null
      scroll_to_bottom(reason, force)
      return
    }

    if (is_near_bottom_ref.current) {
      scroll_to_bottom("typing", false)
    }
  }, [messages.length, scroll_to_bottom, typing.length])

  async function load_older_messages() {
    if (is_loading_older || !has_older_messages || messages.length === 0) {
      return
    }

    set_is_loading_older(true)

    try {
      const params = new URLSearchParams()
      const first_message = messages[0]
      const scroll_container = scroll_ref.current
      const previous_scroll_height = scroll_container?.scrollHeight ?? 0
      const previous_scroll_top = scroll_container?.scrollTop ?? 0

      params.set("locale", locale)
      params.set("room_uuid", room.room_uuid)
      params.set("before", first_message.created_at)
      params.set("limit", "30")

      const response = await fetch(`/api/chat/room?${params.toString()}`, {
        cache: "no-store",
      })

      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as {
        messages: ChatMessageRecord[]
      }
      const older_messages = payload.messages ?? []

      set_has_older_messages(older_messages.length >= 30)

      if (older_messages.length > 0) {
        set_messages((current) => {
          const current_ids = new Set(current.map((message) => message.message_uuid))
          return [
            ...older_messages.filter(
              (message) => !current_ids.has(message.message_uuid),
            ),
            ...current,
          ]
        })
        window.requestAnimationFrame(() => {
          if (!scroll_container) {
            return
          }

          const height_delta =
            scroll_container.scrollHeight - previous_scroll_height
          scroll_container.scrollTop = previous_scroll_top + height_delta
        })
      }
    } finally {
      set_is_loading_older(false)
    }
  }

  const typing_label =
    typing.length > 0
      ? resolveTypingLabel(
          (room.locale as Locale) ?? "ja",
          typing[0]?.display_name ?? "Guest",
        )
      : null

  const visible_messages = show_presence
    ? messages
    : filterUserVisibleChatMessages(messages)

  const scroll_class = fill_height
    ? "h-full space-y-4 overflow-y-auto pt-0"
    : "max-h-[calc(100dvh-220px)] space-y-4 overflow-y-auto pt-0"

  return (
    <section
      className={[
        "relative rounded-none bg-transparent p-0 shadow-none",
        fill_height ? "flex h-full min-h-0 flex-col" : "",
      ].join(" ")}
    >
      <ChatScrollButton
        container_ref={scroll_ref}
        bottom_ref={bottom_ref}
        placement={scroll_button_placement}
        view={realtime_debug_context.view}
      />
      {show_presence && room.mode !== "concierge" ? (
        <div className="mb-3 shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-2 text-[12px] font-medium text-neutral-600">
          {room.mode === "bot" ? content.bot_mode[locale] : room.mode}
        </div>
      ) : null}
      {show_presence && presence.length > 0 ? (
        <div className="mb-3 flex shrink-0 flex-wrap gap-2">
          {presence.map((entry) => (
            <span
              key={entry.participant_uuid}
              className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-600"
            >
              {entry.display_name}
            </span>
          ))}
        </div>
      ) : null}
      <div
        ref={scroll_ref}
        className={scroll_class}
        onScroll={(event) => {
          const target = event.currentTarget
          is_near_bottom_ref.current = is_chat_near_bottom(target)

          if (target.scrollTop < 80) {
            void load_older_messages()
          }
        }}
      >
        {visible_messages.map((message, index) => (
          <ChatMessageBubble
            key={message.message_uuid}
            message={message}
            room_locale={(room.locale as Locale) ?? "ja"}
            viewer_display_name={current_viewer_display_name}
            show_header={shouldShowMessageHeader(
              message,
              visible_messages[index - 1] ?? null,
            )}
          />
        ))}
        {typing_label ? (
          <p className="px-2 text-[12px] font-medium text-[#8c7358]">
            {typing_label}
          </p>
        ) : null}
        <div
          aria-hidden="true"
          className="chat-bottom-spacer shrink-0"
          style={{ height: CHAT_BOTTOM_SPACER_HEIGHT }}
        />
        <div ref={bottom_ref} aria-hidden="true" className="h-0" />
      </div>
    </section>
  )
}
