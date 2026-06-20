"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"
import type { ChatRoomState } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"

type ChatRoomApiPayload = {
  room: ChatRoomState["room"] | null
  participant: ChatRoomState["participant"] | null
  messages: ChatRoomState["messages"]
  presence: ChatRoomState["presence"]
  concierge_available: boolean
}

let bootstrap_promise: Promise<ChatRoomState | null> | null = null
let bootstrap_promise_locale: Locale | null = null
const CHAT_BOOTSTRAP_TIMEOUT_MS = 3000

export type ChatRoomBootstrapViewState = {
  chat_state: ChatRoomState | null
  timed_out: boolean
  loading: boolean
  retry: () => void
  render_state:
    | "loading"
    | "ready_with_messages"
    | "ready_with_welcome"
    | "empty_error_recoverable"
}

function logClientBootstrap(
  event: string,
  data: Record<string, unknown> = {},
) {
  console.info(`[chat_bootstrap] ${event}`, data)
}

async function bootstrapChatRoomRequest(locale: Locale): Promise<ChatRoomState | null> {
  logClientBootstrap("chat_bootstrap_started", { locale })
  logClientBootstrap("message initial fetch start", { locale })
  const response = await fetch("/api/chat/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trigger: "chat_opened", locale }),
  })

  if (!response.ok) {
    const error_message = await response.text().catch(() => "")
    logClientBootstrap("chat_bootstrap_completed", {
      locale,
      ok: false,
      status: response.status,
    })
    logClientBootstrap("message initial fetch error", {
      locale,
      status: response.status,
      error_message,
    })
    return null
  }

  const payload = (await response.json()) as ChatRoomApiPayload

  if (!payload.room || !payload.participant) {
    logClientBootstrap("chat_bootstrap_completed", {
      locale,
      ok: true,
      has_room: Boolean(payload.room),
      has_participant: Boolean(payload.participant),
      message_count: payload.messages?.length ?? 0,
    })
    logClientBootstrap("message initial fetch error", {
      locale,
      reason: "missing_room_or_participant",
      has_room: Boolean(payload.room),
      has_participant: Boolean(payload.participant),
    })
    return null
  }

  logClientBootstrap("user room_uuid resolved", {
    room_uuid: payload.room.room_uuid,
  })
  logClientBootstrap("message initial fetch success count", {
    locale,
    room_uuid: payload.room.room_uuid,
    message_count: payload.messages?.length ?? 0,
  })
  logClientBootstrap("chat_bootstrap_completed", {
    locale,
    ok: true,
    has_room: true,
    has_participant: true,
    message_count: payload.messages?.length ?? 0,
  })

  return {
    room: payload.room,
    participant: payload.participant,
    messages: payload.messages,
    presence: payload.presence,
    concierge_available: payload.concierge_available,
  }
}

function getBootstrapPromise(locale: Locale): Promise<ChatRoomState | null> {
  if (bootstrap_promise && bootstrap_promise_locale === locale) {
    return bootstrap_promise
  }

  bootstrap_promise_locale = locale
  bootstrap_promise = bootstrapChatRoomRequest(locale).catch(() => null)
  return bootstrap_promise
}

export function useChatRoomBootstrap(
  initial_state: ChatRoomState | null,
): ChatRoomBootstrapViewState {
  const { locale } = useLocale()
  const [chat_state, set_chat_state] = useState<ChatRoomState | null>(
    initial_state,
  )
  const [timed_out, set_timed_out] = useState(false)
  const [loading, set_loading] = useState(!initial_state?.room?.room_uuid)
  const request_id_ref = useRef(0)
  const timeout_ref = useRef<number | null>(null)
  const resolved_room_uuid_ref = useRef<string | null>(
    initial_state?.room?.room_uuid ?? null,
  )
  const bootstrap_locale_ref = useRef(locale)

  const clearBootstrapTimeout = useCallback((reason: string) => {
    if (!timeout_ref.current) {
      return
    }

    window.clearTimeout(timeout_ref.current)
    timeout_ref.current = null
    logClientBootstrap("user_chat_timeout_cancelled", { reason })
    send_chat_realtime_debug("user_chat_timeout_cancelled", {
      view: "user",
      reason,
      room_uuid: resolved_room_uuid_ref.current,
    })
  }, [])

  const applyResolvedState = useCallback((state: ChatRoomState) => {
    resolved_room_uuid_ref.current = state.room.room_uuid
    clearBootstrapTimeout("resolve_success")
    set_chat_state(state)
    set_timed_out(false)
    set_loading(false)

    logClientBootstrap("user_chat_client_state_set", {
      room_uuid: state.room.room_uuid,
      row_count: state.messages.length,
    })
    logClientBootstrap("user_chat_messages_state_set", {
      room_uuid: state.room.room_uuid,
      row_count: state.messages.length,
      rendered_count: state.messages.length,
    })
    send_chat_realtime_debug("user_chat_client_state_set", {
      view: "user",
      room_uuid: state.room.room_uuid,
      current_user_uuid: state.room.user_uuid ?? null,
      visitor_uuid: state.room.visitor_uuid ?? null,
      row_count: state.messages.length,
      rendered_count: state.messages.length,
    })
    send_chat_realtime_debug("user_chat_messages_state_set", {
      view: "user",
      room_uuid: state.room.room_uuid,
      current_user_uuid: state.room.user_uuid ?? null,
      visitor_uuid: state.room.visitor_uuid ?? null,
      row_count: state.messages.length,
      rendered_count: state.messages.length,
    })
  }, [clearBootstrapTimeout])

  const resolveRoom = useCallback(
    async (active_locale: Locale) => {
      request_id_ref.current += 1
      const current_request_id = request_id_ref.current

      clearBootstrapTimeout("new_resolve")

      if (resolved_room_uuid_ref.current) {
        set_loading(false)
        return
      }

      set_loading(true)
      set_timed_out(false)

      timeout_ref.current = window.setTimeout(() => {
        timeout_ref.current = null

        if (resolved_room_uuid_ref.current) {
          return
        }

        set_timed_out(true)
        set_loading(false)
      }, CHAT_BOOTSTRAP_TIMEOUT_MS)

      try {
        const state = await getBootstrapPromise(active_locale)

        if (current_request_id !== request_id_ref.current) {
          logClientBootstrap("user_chat_resolve_ignored_stale_request", {
            current_request_id,
            active_request_id: request_id_ref.current,
          })
          send_chat_realtime_debug("user_chat_resolve_ignored_stale_request", {
            view: "user",
            current_request_id,
            active_request_id: request_id_ref.current,
          })
          return
        }

        if (state) {
          applyResolvedState(state)
          return
        }

        if (resolved_room_uuid_ref.current) {
          return
        }

        clearBootstrapTimeout("resolve_empty")
        set_timed_out(true)
        set_loading(false)
      } catch {
        if (current_request_id !== request_id_ref.current) {
          logClientBootstrap("user_chat_resolve_ignored_stale_request", {
            current_request_id,
            active_request_id: request_id_ref.current,
            reason: "error",
          })
          send_chat_realtime_debug("user_chat_resolve_ignored_stale_request", {
            view: "user",
            current_request_id,
            active_request_id: request_id_ref.current,
            reason: "error",
          })
          return
        }

        if (resolved_room_uuid_ref.current) {
          return
        }

        clearBootstrapTimeout("resolve_error")
        set_timed_out(true)
        set_loading(false)
      }
    },
    [applyResolvedState, clearBootstrapTimeout],
  )

  useEffect(() => {
    if (initial_state?.room?.room_uuid) {
      resolved_room_uuid_ref.current = initial_state.room.room_uuid
      set_loading(false)
      return
    }

    if (bootstrap_locale_ref.current !== locale) {
      bootstrap_promise = null
      bootstrap_promise_locale = null
      resolved_room_uuid_ref.current = null
      bootstrap_locale_ref.current = locale
    }

    void resolveRoom(locale)

    return () => {
      clearBootstrapTimeout("unmount")
    }
  }, [clearBootstrapTimeout, initial_state?.room?.room_uuid, locale, resolveRoom])

  const render_state = chat_state
    ? chat_state.messages.length > 0
      ? "ready_with_messages"
      : "ready_with_welcome"
    : timed_out
      ? "empty_error_recoverable"
      : "loading"

  useEffect(() => {
    const room_uuid = chat_state?.room?.room_uuid ?? null
    const message_count = chat_state?.messages.length ?? 0

    logClientBootstrap("user_chat_render_state", {
      room_uuid,
      message_count,
      rendered_count: message_count,
      loading,
      render_state,
    })
    send_chat_realtime_debug("user_chat_render_state", {
      view: "user",
      room_uuid,
      message_count,
      rendered_count: message_count,
      loading,
      render_state,
    })
  }, [
    chat_state?.messages.length,
    chat_state?.room?.room_uuid,
    loading,
    render_state,
  ])

  const retry = useCallback(() => {
    bootstrap_promise = null
    bootstrap_promise_locale = null
    resolved_room_uuid_ref.current = null
    set_chat_state(null)
    set_timed_out(false)
    void resolveRoom(locale)
  }, [locale, resolveRoom])

  return { chat_state, timed_out, loading, retry, render_state }
}
