"use client"

import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

import ChatSendButton from "@/components/chat/send_button"
import { send_chat_realtime_debug } from "@/components/chat/realtime_debug"
import {
  create_client_message_id,
  dispatch_message_archived,
  dispatch_message_created,
  dispatch_message_failed,
  dispatch_optimistic_message,
  send_chat_message,
} from "@/components/chat/send_client_message"
import type { Locale } from "@/src/lib/locale"
import { ui_layer_class } from "@/src/ui/layers"

const content = {
  placeholder: {
    ja: "メッセージを入力",
    en: "Type a message",
    es: "Escribe un mensaje",
  },
}

type ChatMessageInputProps = {
  locale: Locale
  room_uuid?: string | null
  participant_uuid?: string | null
  on_sent?: () => void
}

export default function ChatMessageInput({
  locale,
  room_uuid = null,
  participant_uuid = null,
  on_sent,
}: Readonly<ChatMessageInputProps>) {
  const [input_value, set_input_value] = useState("")
  const [is_sending, set_is_sending] = useState(false)
  const [profile_modal_open, set_profile_modal_open] = useState(false)
  const input_value_ref = useRef("")
  const textarea_ref = useRef<HTMLTextAreaElement>(null)
  const typing_timer_ref = useRef<number | null>(null)
  const is_sending_ref = useRef(false)

  useEffect(() => {
    function handle_profile_modal_visibility(event: Event) {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      set_profile_modal_open(detail?.open === true)
    }

    window.addEventListener(
      "amp-profile-settings-visibility",
      handle_profile_modal_visibility,
    )

    return () => {
      if (typing_timer_ref.current) {
        window.clearTimeout(typing_timer_ref.current)
      }
      window.removeEventListener(
        "amp-profile-settings-visibility",
        handle_profile_modal_visibility,
      )
    }
  }, [])

  function send_typing(is_typing: boolean) {
    if (typing_timer_ref.current) {
      window.clearTimeout(typing_timer_ref.current)
      typing_timer_ref.current = null
    }

    void fetch("/api/chat/typing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_typing, room_uuid }),
    }).catch(() => null)

    if (is_typing) {
      typing_timer_ref.current = window.setTimeout(() => {
        send_typing(false)
      }, 5000)
    }
  }

  function clear_input() {
    input_value_ref.current = ""
    set_input_value("")
    if (textarea_ref.current) {
      textarea_ref.current.value = ""
    }
    send_chat_realtime_debug("chat_input_cleared", {
      view: "concierge",
      room_uuid,
    })
  }

  function handle_send_message() {
    const text = input_value_ref.current.trim()

    if (!text || is_sending_ref.current) {
      return
    }

    const client_message_id = create_client_message_id()

    dispatch_optimistic_message({
      room_uuid,
      participant_uuid,
      body: text,
      client_message_id,
    })

    flushSync(() => {
      clear_input()
    })
    send_typing(false)

    send_chat_realtime_debug("chat_send_started", {
      view: "concierge",
      room_uuid,
      client_message_id,
    })

    is_sending_ref.current = true
    set_is_sending(true)

    void (async () => {
      try {
        const result = await send_chat_message({
          message: text,
          locale,
          room_uuid,
          client_message_id,
        })

        if (!result.ok) {
          send_chat_realtime_debug("chat_send_failed", {
            view: "concierge",
            room_uuid,
            client_message_id,
          })
          dispatch_message_failed(client_message_id)
          return
        }

        send_chat_realtime_debug("chat_send_success", {
          view: "concierge",
          room_uuid,
          client_message_id,
        })

        if (result.payload?.message) {
          dispatch_message_archived({
            room_uuid,
            message: result.payload.message,
          })
        }

        dispatch_message_created()
        on_sent?.()
      } catch {
        send_chat_realtime_debug("chat_send_failed", {
          view: "concierge",
          room_uuid,
          client_message_id,
        })
        dispatch_message_failed(client_message_id)
      } finally {
        is_sending_ref.current = false
        set_is_sending(false)
      }
    })()
  }

  function set_chat_input_value(value: string) {
    input_value_ref.current = value
    set_input_value(value)
  }

  if (profile_modal_open) {
    return null
  }

  return (
    <div
      className={[
        "fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white px-4 py-3",
        ui_layer_class.chat_composer,
      ].join(" ")}
    >
      <div className="mx-auto flex w-full max-w-[430px] items-end gap-2">
        <textarea
          ref={textarea_ref}
          value={input_value}
          rows={1}
          placeholder={content.placeholder[locale]}
          onChange={(event) => {
            set_chat_input_value(event.target.value)
            send_typing(Boolean(event.target.value.trim()))
            window.dispatchEvent(new CustomEvent("amp-chat-input-resized"))
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.shiftKey) {
              return
            }

            if (event.key === "Enter") {
              event.preventDefault()
              handle_send_message()
            }
          }}
          className="min-h-11 flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] leading-6 text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        />
        <ChatSendButton
          locale={locale}
          disabled={is_sending}
          variant="compact"
          onClick={handle_send_message}
        />
      </div>
    </div>
  )
}
