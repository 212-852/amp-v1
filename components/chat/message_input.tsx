"use client"

import { useEffect, useRef, useState } from "react"

import ChatSendButton from "@/components/chat/send_button"
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
  const [value, set_value] = useState("")
  const [is_sending, set_is_sending] = useState(false)
  const [profile_modal_open, set_profile_modal_open] = useState(false)
  const typing_timer_ref = useRef<number | null>(null)

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

  async function send_message() {
    const text = value.trim()

    if (!text || is_sending) {
      return
    }

    set_value("")
    send_typing(false)

    const client_message_id = `client:${crypto.randomUUID()}`

    window.dispatchEvent(
      new CustomEvent("amp-chat-optimistic-message", {
        detail: {
          room_uuid,
          participant_uuid,
          body: text,
          client_message_id,
        },
      }),
    )
    set_is_sending(true)

    try {
      const response = await fetch("/api/chat/room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          locale,
          room_uuid,
          client_message_id,
        }),
      })

      if (!response.ok) {
        window.dispatchEvent(
          new CustomEvent("amp-chat-message-failed", {
            detail: { client_message_id },
          }),
        )
        return
      }

      const payload = (await response.json().catch(() => null)) as {
        message?: unknown
      } | null

      if (payload?.message) {
        window.dispatchEvent(
          new CustomEvent("amp-chat-message-archived", {
            detail: {
              room_uuid,
              message: payload.message,
            },
          }),
        )
      }

      window.dispatchEvent(new CustomEvent("amp-chat-message-created"))
      on_sent?.()
    } catch {
      window.dispatchEvent(
        new CustomEvent("amp-chat-message-failed", {
          detail: { client_message_id },
        }),
      )
    } finally {
      set_is_sending(false)
    }
  }

  if (profile_modal_open) {
    return null
  }

  return (
    <form
      className={[
        "fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white px-4 py-3",
        ui_layer_class.chat_composer,
      ].join(" ")}
      onSubmit={(event) => {
        event.preventDefault()
        void send_message()
      }}
    >
      <div className="mx-auto flex w-full max-w-[430px] items-end gap-2">
        <textarea
          value={value}
          rows={1}
          placeholder={content.placeholder[locale]}
          onChange={(event) => {
            set_value(event.target.value)
            send_typing(Boolean(event.target.value.trim()))
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void send_message()
            }
          }}
          className="min-h-11 flex-1 resize-none rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] leading-6 text-neutral-900 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200"
        />
        <ChatSendButton
          type="submit"
          locale={locale}
          disabled={!value.trim() || is_sending}
          variant="compact"
        />
      </div>
    </form>
  )
}
