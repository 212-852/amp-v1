"use client"

import { Bot, Headphones, Menu, MessageCircle, RefreshCw, User } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"

import ConciergeMemberModal from "@/components/app/concierge_member_modal"
import ChatSendButton from "@/components/chat/send_button"
import { useOverlay, type OverlayType } from "@/components/overlay"
import { useToast } from "@/components/ui/use_toast"
import {
  applyChatSupportSwitch,
  type ChatSupportAccess,
  type ChatSupportMode,
} from "@/core/chat/support"
import {
  buildModeChangeToast,
  chat_mode_toast_content,
  resolveChatContent,
} from "@/core/chat/mode_toast_content"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"
import { ui_layer_class } from "@/src/ui/layers"

type FooterMode = "normal" | "input"

const content = {
  open_message_input: {
    ja: "メッセージ入力を開く",
    en: "Open message input",
    es: "Abrir mensaje",
  },
  close_message_input: {
    ja: "メッセージ入力を閉じる",
    en: "Close message input",
    es: "Cerrar mensaje",
  },
  switch_input_menu: {
    ja: "チャット入力とクイックメニューを切り替える",
    en: "Switch between chat input and quick menu",
    es: "Cambiar entre chat y menu rapido",
  },
  message: {
    ja: "メッセージ",
    en: "Message",
    es: "Mensaje",
  },
  message_placeholder: {
    ja: resolveChatContent("message_placeholder", "ja"),
    en: resolveChatContent("message_placeholder", "en"),
    es: resolveChatContent("message_placeholder", "es"),
  },
  footer_menu: {
    ja: "フッターメニュー",
    en: "Footer menu",
    es: "Menu inferior",
  },
  my_page: {
    ja: "My Page",
    en: "My Page",
    es: "Mi pagina",
  },
  quick_menu: {
    ja: "Quick Menu",
    en: "Quick Menu",
    es: "Menu rapido",
  },
  menu: {
    ja: "Menu",
    en: "Menu",
    es: "Menu",
  },
}

const footer_shell_class =
  "relative mx-auto h-[186px] w-full max-w-[430px]"

const fixed_paw_button_class = [
  "flex h-[60px] w-[60px]",
  "items-center justify-center rounded-full border border-[#dcc7aa]",
  "bg-[#fdfaf6] shadow-[0_8px_18px_rgba(122,78,34,0.18)]",
  "ring-[5px] ring-[#ead7c3]",
].join(" ")

const fixed_paw_button_position_class = "top-[20px]"

const fixed_paw_cluster_class = [
  "absolute left-3 z-30 flex items-center gap-2",
  fixed_paw_button_position_class,
].join(" ")

function FooterCurve() {
  return (
    <svg
      aria-hidden="true"
      className="footer_wave pointer-events-none absolute inset-x-0 bottom-0 z-0 h-full w-full text-[#ead7c3]"
      preserveAspectRatio="none"
      viewBox="0 0 430 186"
    >
      <path
        d="M0 116C118 118 134 98 216 96C304 94 329 110 430 104V186H0Z"
        fill="currentColor"
      />
    </svg>
  )
}

function PinkPawIcon() {
  return (
    <Image
      src="/images/icon.svg"
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
      priority
      onError={(event) => {
        event.currentTarget.src = "/images/icon.webp"
      }}
    />
  )
}

function PawModeIndicator({
  assistantMode,
}: Readonly<{
  assistantMode: ChatSupportMode
}>) {
  const Icon = assistantMode === "concierge" ? Headphones : Bot

  return (
    <span
      aria-hidden="true"
      className="flex h-[60px] w-5 shrink-0 items-center justify-center text-[#8f5d28]"
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </span>
  )
}

function PawButtonCluster({
  isInputMode,
  assistantMode,
  locale,
  onClick,
}: Readonly<{
  isInputMode: boolean
  assistantMode: ChatSupportMode
  locale: Locale
  onClick: () => void
}>) {
  return (
    <div className={fixed_paw_cluster_class}>
      <button
        type="button"
        aria-label={content.switch_input_menu[locale]}
        aria-pressed={isInputMode}
        onClick={onClick}
        className={[fixed_paw_button_class, "relative"].join(" ")}
      >
        <PinkPawIcon />
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#dcc7aa] bg-[#fff8ef] text-[#8f5d28] shadow-[0_3px_8px_rgba(122,78,34,0.18)]"
        >
          <RefreshCw className="h-3 w-3" strokeWidth={2.4} />
        </span>
      </button>
      {isInputMode ? <PawModeIndicator assistantMode={assistantMode} /> : null}
    </div>
  )
}

function AssistantToggle({
  assistantMode,
  onAttemptChange,
  locale,
}: {
  assistantMode: ChatSupportMode
  onAttemptChange: (mode: ChatSupportMode) => boolean
  locale: Locale
}) {
  const isConcierge = assistantMode === "concierge"
  const [is_sliding, set_is_sliding] = useState(false)
  const [is_pressed, set_is_pressed] = useState(false)

  useEffect(() => {
    if (!is_sliding) {
      return
    }

    const timer = window.setTimeout(() => {
      set_is_sliding(false)
    }, 520)

    return () => {
      window.clearTimeout(timer)
    }
  }, [is_sliding])

  function handleChange(mode: ChatSupportMode) {
    if (mode === assistantMode) {
      return
    }

    const accepted = onAttemptChange(mode)

    if (accepted) {
      set_is_sliding(true)
    }
  }

  return (
    <div
      className={[
        "relative mx-auto grid h-12 w-full max-w-[300px]",
        "grid-cols-2 overflow-hidden rounded-full bg-[#E6D4B8] p-1",
        "transition-transform duration-[90ms] ease-out",
        is_pressed ? "scale-[0.985]" : "scale-100",
      ].join(" ")}
      onPointerDown={() => set_is_pressed(true)}
      onPointerLeave={() => set_is_pressed(false)}
      onPointerCancel={() => set_is_pressed(false)}
      onPointerUp={() => set_is_pressed(false)}
    >
      <div
        aria-hidden="true"
        className={[
          "absolute bottom-1 left-1 top-1 w-[calc(50%-4px)]",
          "transition-transform duration-[520ms] ease-[cubic-bezier(0.16,1.25,0.32,1)]",
          isConcierge ? "translate-x-full" : "translate-x-0",
        ].join(" ")}
      >
        <span
          className={[
            "block h-full w-full rounded-full bg-[#A06A2A]",
            "shadow-[0_8px_18px_rgba(126,78,32,0.22)]",
            "origin-center",
            is_sliding
              ? "animate-[bot-concierge-thumb-squish_520ms_cubic-bezier(0.16,1.25,0.32,1)]"
              : "",
          ].join(" ")}
        />
      </div>
      <button
        type="button"
        onClick={() => handleChange("bot")}
        aria-pressed={assistantMode === "bot"}
        className={[
          "relative z-10 flex items-center justify-center rounded-full",
          "text-[18px] font-semibold leading-none",
          "transition-colors delay-[90ms] duration-[220ms] ease-out",
          assistantMode === "bot"
            ? "text-white"
            : "text-[rgba(120,85,55,0.72)]",
        ].join(" ")}
      >
        {chat_mode_toast_content.mode_bot_label[locale]}
      </button>
      <button
        type="button"
        onClick={() => handleChange("concierge")}
        aria-pressed={assistantMode === "concierge"}
        className={[
          "relative z-10 flex items-center justify-center rounded-full",
          "text-[18px] font-semibold leading-none",
          "transition-colors delay-[90ms] duration-[220ms] ease-out",
          assistantMode === "concierge"
            ? "text-white"
            : "text-[rgba(120,85,55,0.72)]",
        ].join(" ")}
      >
        {chat_mode_toast_content.mode_concierge_label[locale]}
      </button>
      <style jsx>{`
        @keyframes bot-concierge-thumb-squish {
          0% {
            transform: scaleX(1);
          }

          45% {
            transform: scaleX(1.18);
          }

          78% {
            transform: scaleX(0.96);
          }

          100% {
            transform: scaleX(1);
          }
        }
      `}</style>
    </div>
  )
}

function MessageInputRow({
  locale,
  onSend,
  onTyping,
  input_ref,
}: Readonly<{
  locale: Locale
  onSend: (message: string) => Promise<void>
  onTyping: (is_typing: boolean) => void
  input_ref?: RefObject<HTMLTextAreaElement | null>
}>) {
  const [draft, set_draft] = useState("")
  const [is_sending, set_is_sending] = useState(false)

  async function handleSend() {
    const message = draft.trim()

    if (!message || is_sending) {
      return
    }

    set_is_sending(true)

    try {
      await onSend(message)
      set_draft("")
      onTyping(false)
    } finally {
      set_is_sending(false)
    }
  }

  return (
    <div className="w-full px-4">
      <div className="flex w-full items-center gap-4">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="app-message-input">
            {content.message[locale]}
          </label>
          <textarea
            ref={input_ref}
            id="app-message-input"
            value={draft}
            rows={1}
            onChange={(event) => {
              set_draft(event.target.value)
              onTyping(event.target.value.trim().length > 0)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void handleSend()
              }
            }}
            placeholder={content.message_placeholder[locale]}
            className="h-[58px] w-full min-w-0 resize-none rounded-full border border-transparent bg-[#fdfaf6] px-5 py-4 text-[16px] font-semibold leading-6 text-[#3d2a19] outline-none placeholder:text-[#8c7358] transition-[border-color,box-shadow] duration-150 focus:border-[#c49a6c] focus:shadow-[0_0_0_4px_rgba(164,106,42,0.16)]"
          />
        </div>
        <ChatSendButton
          locale={locale}
          disabled={is_sending}
          onClick={() => void handleSend()}
        />
      </div>
    </div>
  )
}

function BottomMenuRow({
  onQuickMenu,
}: Readonly<{
  onQuickMenu: () => void
}>) {
  const { openOverlay } = useOverlay()
  const { locale } = useLocale()
  const items = [
    { label: content.my_page[locale], icon: User, overlayType: "my_page" },
    { label: content.quick_menu[locale], icon: MessageCircle, quickMenu: true },
    { label: content.menu[locale], icon: Menu, overlayType: "menu" },
  ]

  return (
    <nav
      aria-label={content.footer_menu[locale]}
      className="grid w-full grid-cols-3 gap-1 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] text-[#8f5d28]"
    >
      {items.map((item) => {
        const Icon = item.icon

        return (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              if (item.quickMenu) {
                onQuickMenu()
                return
              }

              if (item.overlayType) {
                openOverlay({
                  type: item.overlayType as OverlayType,
                  source: "user",
                })
              }
            }}
            className="flex flex-col items-center justify-center gap-1 py-1 text-[16px] font-semibold leading-tight"
          >
            <Icon className="h-[25px] w-[25px]" strokeWidth={2} />
            <span className="text-center">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function CopyrightText() {
  return (
    <p className="mt-3 translate-y-[7px] text-center text-[11px] font-normal leading-none text-[#8c7358] opacity-[0.45]">
      © 2026 Wan Da Nya Inc.
    </p>
  )
}

export default function AppFooter({
  support_access,
  can_start_line_oauth,
  initial_mode = "bot",
}: Readonly<{
  support_access: ChatSupportAccess
  can_start_line_oauth: boolean
  initial_mode?: ChatSupportMode
}>) {
  const [footerMode, setFooterMode] = useState<FooterMode>(
    initial_mode === "concierge" ? "input" : "normal",
  )
  const [assistantMode, setAssistantMode] = useState<ChatSupportMode>(
    initial_mode === "concierge" ? "concierge" : "bot",
  )
  const [member_modal_open, set_member_modal_open] = useState(false)
  const [profile_modal_open, set_profile_modal_open] = useState(false)
  const typing_timer_ref = useRef<number | null>(null)
  const footer_ref = useRef<HTMLElement | null>(null)
  const message_input_ref = useRef<HTMLTextAreaElement | null>(null)
  const pending_input_focus_ref = useRef(false)
  const { locale } = useLocale()
  const { openOverlay } = useOverlay()
  const { toast } = useToast()
  const isInputMode = footerMode === "input"

  const settleChatInput = useCallback(() => {
    pending_input_focus_ref.current = true
    setFooterMode("input")
    window.dispatchEvent(new CustomEvent("amp-chat-scroll-bottom"))
  }, [])

  const settleChatToggle = useCallback(() => {
    pending_input_focus_ref.current = false
    setFooterMode("normal")
  }, [])

  function toggleFooterMode() {
    if (assistantMode === "concierge") {
      settleChatInput()
      return
    }

    setFooterMode((current) => (current === "normal" ? "input" : "normal"))
  }

  const refreshCurrentMode = useCallback(async () => {
    const response = await fetch(
      `/api/chat/room?locale=${encodeURIComponent(locale)}`,
      { cache: "no-store" },
    ).catch(() => null)

    if (!response?.ok) {
      return
    }

    const payload = (await response.json().catch(() => null)) as {
      room?: { mode?: ChatSupportMode } | null
    } | null
    const mode = payload?.room?.mode

    if (mode === "bot" || mode === "concierge") {
      setAssistantMode(mode)
      if (mode === "concierge") {
        settleChatInput()
      } else {
        settleChatToggle()
      }
      window.dispatchEvent(
        new CustomEvent("amp-chat-mode-changed", {
          detail: { mode },
        }),
      )
    }
  }, [locale, settleChatInput, settleChatToggle])

  async function persistModeSwitch(mode: ChatSupportMode) {
    const response = await fetch("/api/chat/mode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode, locale }),
    })

    if (!response.ok) {
      throw new Error("mode_change_failed")
    }

    const payload = (await response.json().catch(() => null)) as {
      room?: { mode?: ChatSupportMode } | null
    } | null
    const persisted_mode = payload?.room?.mode
    const resolved_mode =
      persisted_mode === "bot" || persisted_mode === "concierge"
        ? persisted_mode
        : mode

    window.dispatchEvent(
      new CustomEvent("amp-chat-mode-changed", {
        detail: { mode: resolved_mode },
      }),
    )
  }

  function handleAssistantModeAttempt(mode: ChatSupportMode) {
    const result = applyChatSupportSwitch({
      requested_mode: mode,
      current_mode: assistantMode,
      access: support_access,
    })

    if (result.outcome === "switch") {
      const previous_mode = assistantMode
      setAssistantMode(result.mode)
      if (result.mode === "concierge") {
        settleChatInput()
      } else {
        settleChatToggle()
      }
      void persistModeSwitch(result.mode)
        .then(() => {
          const toast_output = buildModeChangeToast({
            mode: result.mode,
            locale,
          })
          toast({
            tone: toast_output.tone,
            placement: "anchor",
            anchor_ref: footer_ref,
            compact: true,
            duration_ms: 2750,
            message: toast_output.message,
          })
        })
        .catch(() => {
          setAssistantMode(previous_mode)
          if (previous_mode === "concierge") {
            settleChatInput()
          } else {
            settleChatToggle()
          }
          window.dispatchEvent(
            new CustomEvent("amp-chat-mode-changed", {
              detail: { mode: previous_mode },
            }),
          )
          const toast_output = buildModeChangeToast({
            mode: result.mode,
            locale,
            failed: true,
          })
          toast({
            tone: toast_output.tone,
            placement: "anchor",
            anchor_ref: footer_ref,
            compact: true,
            duration_ms: 2750,
            message: toast_output.message,
          })
        })
      return true
    }

    if (result.show_member_modal) {
      set_member_modal_open(true)
    }

    if (result.mode !== assistantMode) {
      setAssistantMode(result.mode)
    }

    return false
  }

  async function handleSendMessage(message: string) {
    const client_message_id = `client:${crypto.randomUUID()}`

    window.dispatchEvent(
      new CustomEvent("amp-chat-optimistic-message", {
        detail: {
          body: message,
          client_message_id,
        },
      }),
    )

    try {
      const response = await fetch("/api/chat/room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, locale, client_message_id }),
      })

      if (!response.ok) {
        window.dispatchEvent(
          new CustomEvent("amp-chat-message-failed", {
            detail: { client_message_id },
          }),
        )
        return
      }
    } catch {
      window.dispatchEvent(
        new CustomEvent("amp-chat-message-failed", {
          detail: { client_message_id },
        }),
      )
      return
    }

    await refreshCurrentMode()
    window.dispatchEvent(new CustomEvent("amp-chat-message-created"))
  }

  async function handleQuickMenu() {
    await fetch("/api/chat/room", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger: "quick_menu_requested", locale }),
    }).catch(() => null)

    window.dispatchEvent(new CustomEvent("amp-chat-message-created"))
  }

  function handleTyping(is_typing: boolean) {
    if (typing_timer_ref.current) {
      window.clearTimeout(typing_timer_ref.current)
      typing_timer_ref.current = null
    }

    void fetch("/api/chat/typing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_typing }),
    }).catch(() => null)

    if (is_typing) {
      typing_timer_ref.current = window.setTimeout(() => {
        void fetch("/api/chat/typing", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_typing: false }),
        }).catch(() => null)
      }, 5000)
    }
  }

  function handleLinkAccount() {
    set_member_modal_open(false)
    openOverlay({
      type: "link",
      source: "user",
      can_start_line_oauth,
    })
  }

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
      window.removeEventListener(
        "amp-profile-settings-visibility",
        handle_profile_modal_visibility,
      )
    }
  }, [])

  useEffect(() => {
    function handle_mode_change(event: Event) {
      const detail = (event as CustomEvent<{ mode?: ChatSupportMode }>).detail

      if (detail?.mode === "bot" || detail?.mode === "concierge") {
        setAssistantMode(detail.mode)
        if (detail.mode === "concierge") {
          settleChatInput()
        } else {
          settleChatToggle()
        }
      }
    }

    window.addEventListener("amp-chat-mode-changed", handle_mode_change)
    const timer = window.setTimeout(() => {
      void refreshCurrentMode()
    }, 0)

    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("amp-chat-mode-changed", handle_mode_change)
    }
  }, [refreshCurrentMode, settleChatInput, settleChatToggle])

  useEffect(() => {
    if (!isInputMode || !pending_input_focus_ref.current) {
      return
    }

    const timer = window.setTimeout(() => {
      message_input_ref.current?.focus({ preventScroll: true })
      window.dispatchEvent(new CustomEvent("amp-chat-scroll-bottom"))
      pending_input_focus_ref.current = false
    }, 320)

    return () => {
      window.clearTimeout(timer)
    }
  }, [isInputMode, assistantMode])

  if (profile_modal_open) {
    return null
  }

  return (
    <footer
      ref={footer_ref}
      className={[
        "chat_input_footer fixed left-1/2 right-auto bottom-[calc(env(safe-area-inset-bottom,0px)+18px)] w-full max-w-[430px] -translate-x-1/2",
        ui_layer_class.chat_composer,
      ].join(" ")}
    >
      <div className={footer_shell_class}>
        <FooterCurve />
        <PawButtonCluster
          isInputMode={isInputMode}
          assistantMode={assistantMode}
          locale={locale}
          onClick={toggleFooterMode}
        />

        <div className="relative z-10 flex h-full flex-col pt-[20px] pb-1">
          <div
            className={[
              "shrink-0 [perspective:1000px]",
              isInputMode
                ? "h-[162px]"
                : "h-[144px]",
            ].join(" ")}
          >
            <div className="relative h-full w-full [transform-style:preserve-3d]">
              <div
                className={[
                  "absolute inset-0 flex flex-col justify-end gap-2 pt-[54px]",
                  "transition-[transform,opacity] duration-[280ms] ease-out",
                  "[backface-visibility:hidden] [transform-style:preserve-3d]",
                  isInputMode
                    ? "pointer-events-none opacity-0 [transform:translateX(-38px)_rotateY(-58deg)]"
                    : "opacity-100 [transform:translateX(0)_rotateY(0deg)]",
                ].join(" ")}
              >
                <div className="ml-[86px] mr-4 shrink-0">
                  <AssistantToggle
                    assistantMode={assistantMode}
                    locale={locale}
                    onAttemptChange={handleAssistantModeAttempt}
                  />
                </div>
                <BottomMenuRow onQuickMenu={() => void handleQuickMenu()} />
              </div>

              <div
                className={[
                  "absolute inset-0 flex flex-col justify-end pb-1",
                  "transition-[transform,opacity] duration-[280ms] ease-out",
                  "[backface-visibility:hidden] [transform-style:preserve-3d]",
                  isInputMode
                    ? "opacity-100 [transform:translateX(0)_rotateY(0deg)]"
                    : "pointer-events-none opacity-0 [transform:translateX(38px)_rotateY(58deg)]",
                ].join(" ")}
              >
                <MessageInputRow
                  locale={locale}
                  onSend={handleSendMessage}
                  onTyping={handleTyping}
                  input_ref={message_input_ref}
                />
                <CopyrightText />
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConciergeMemberModal
        open={member_modal_open}
        onClose={() => set_member_modal_open(false)}
        onLinkAccount={handleLinkAccount}
      />
    </footer>
  )
}
