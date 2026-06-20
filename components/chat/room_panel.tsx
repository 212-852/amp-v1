"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import ChatMessageBubble from "@/components/chat/message_bubble"
import ChatScrollButton from "@/components/chat/scroll"
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

function mergeMessage(
  current: ChatMessageRecord[],
  next_message: ChatMessageRecord,
) {
  const next_client_id = getClientMessageId(next_message)
  let replaced = false
  const merged = current.map((message) => {
    if (message.message_uuid === next_message.message_uuid) {
      replaced = true
      return next_message
    }

    if (next_client_id && getClientMessageId(message) === next_client_id) {
      replaced = true
      return next_message
    }

    return message
  })

  if (!replaced) {
    merged.push(next_message)
  }

  return merged.sort(
    (left, right) =>
      new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  )
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
    status: "sent",
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
    set_messages(payload.messages)
    set_has_older_messages(payload.messages.length >= 30)

    if (payload.presence) {
      set_presence(payload.presence)
    }
  }, [locale, room.mode, room.room_uuid, room_uuid, show_presence])

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
          event: "*",
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `room_uuid=eq.${room.room_uuid}`,
        },
        (payload) => {
          const next_message = payload.new as ChatMessageRecord

          set_messages((current) => mergeMessage(current, next_message))
          window.dispatchEvent(new CustomEvent("amp-admin-queue-refresh"))
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
    bottom_ref.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, typing.length])

  useEffect(() => {
    function handle_scroll_bottom() {
      bottom_ref.current?.scrollIntoView({ behavior: "smooth" })
    }

    window.addEventListener("amp-chat-scroll-bottom", handle_scroll_bottom)

    return () => {
      window.removeEventListener("amp-chat-scroll-bottom", handle_scroll_bottom)
    }
  }, [])

  useEffect(() => {
    function handle_mode_change(event: Event) {
      const detail = (event as CustomEvent<{ mode: ChatRoomMode }>).detail

      if (detail?.mode) {
        set_room((current) => ({ ...current, mode: detail.mode }))
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
        body?: string
        client_message_id?: string
      }>).detail

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

      set_messages((current) =>
        mergeMessage(
          current,
          buildOptimisticMessage({
            room_uuid: room.room_uuid,
            participant_uuid,
            body,
            client_message_id,
            source_kind: show_presence ? "concierge" : "user",
            actor_display_name: current_viewer_display_name,
            locale: (room.locale as Locale) ?? "ja",
          }),
        ),
      )
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
    room.locale,
    room.room_uuid,
    show_presence,
  ])

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

  async function load_older_messages() {
    if (is_loading_older || !has_older_messages || messages.length === 0) {
      return
    }

    set_is_loading_older(true)

    try {
      const params = new URLSearchParams()
      const first_message = messages[0]

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
    ? "h-full space-y-4 overflow-y-auto pt-0 pb-[var(--chat-message-bottom-padding,24px)]"
    : "max-h-[calc(100dvh-220px)] space-y-4 overflow-y-auto pt-0 pb-[var(--chat-message-bottom-padding,24px)]"

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
          if (event.currentTarget.scrollTop < 80) {
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
        <div ref={bottom_ref} />
      </div>
    </section>
  )
}
