"use client"

import { Cat, Menu, MessageCircle, PawPrint, User } from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"

import { useOverlay, type OverlayType } from "@/components/overlay"
import { useLocale } from "@/src/components/locale/provider"
import type { Locale } from "@/src/lib/locale"

type FooterMode = "normal" | "input"
type AssistantMode = "bot" | "concierge"

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
  bot: {
    ja: "Bot",
    en: "Bot",
    es: "Bot",
  },
  concierge: {
    ja: "Concierge",
    en: "Concierge",
    es: "Conserje",
  },
  send: {
    ja: "送信",
    en: "Send",
    es: "Enviar",
  },
  message: {
    ja: "メッセージ",
    en: "Message",
    es: "Mensaje",
  },
  message_placeholder: {
    ja: "メッセージを入力",
    en: "Type a message",
    es: "Escribe un mensaje",
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
  "absolute left-3 z-30 flex h-[60px] w-[60px]",
  "items-center justify-center rounded-full border border-[#dcc7aa]",
  "bg-[#fdfaf6] shadow-[0_8px_18px_rgba(122,78,34,0.18)]",
  "ring-[5px] ring-[#ead7c3]",
].join(" ")

const fixed_paw_button_position_class = "top-[20px]"

function FooterCurve() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full text-[#ead7c3]"
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
      src="/icon.svg"
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

function PinkPawButton({
  isInputMode,
  onClick,
  locale,
}: {
  isInputMode: boolean
  onClick: () => void
  locale: Locale
}) {
  return (
    <button
      type="button"
      aria-label={
        isInputMode
          ? content.close_message_input[locale]
          : content.open_message_input[locale]
      }
      aria-pressed={isInputMode}
      onClick={onClick}
      className={[
        fixed_paw_button_class,
        fixed_paw_button_position_class,
      ].join(" ")}
    >
      <PinkPawIcon />
    </button>
  )
}

function AssistantToggle({
  assistantMode,
  onChange,
  locale,
}: {
  assistantMode: AssistantMode
  onChange: (mode: AssistantMode) => void
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

  function handleChange(mode: AssistantMode) {
    if (mode === assistantMode) {
      return
    }

    set_is_sliding(true)
    onChange(mode)
  }

  return (
    <div
      className={[
        "relative mx-auto grid h-12 w-full max-w-[340px] translate-y-[2px]",
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
          "relative z-10 rounded-full text-[19px] font-semibold leading-none",
          "transition-colors delay-[90ms] duration-[220ms] ease-out",
          assistantMode === "bot"
            ? "text-white"
            : "text-[rgba(120,85,55,0.72)]",
        ].join(" ")}
      >
        {content.bot[locale]}
      </button>
      <button
        type="button"
        onClick={() => handleChange("concierge")}
        aria-pressed={assistantMode === "concierge"}
        className={[
          "relative z-10 rounded-full text-[19px] font-semibold leading-none",
          "transition-colors delay-[90ms] duration-[220ms] ease-out",
          assistantMode === "concierge"
            ? "text-white"
            : "text-[rgba(120,85,55,0.72)]",
        ].join(" ")}
      >
        {content.concierge[locale]}
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

function SendPawButton({ locale }: Readonly<{ locale: Locale }>) {
  return (
    <button
      type="button"
      aria-label={content.send[locale]}
      className="flex h-[62px] w-[58px] shrink-0 items-center justify-center bg-transparent p-0 text-[#8f5d28] shadow-none"
    >
      <PawPrint
        className="h-[58px] w-[58px] fill-[#8f5d28] text-[#8f5d28]"
        strokeWidth={3}
      />
    </button>
  )
}

function MessageInputRow({ locale }: Readonly<{ locale: Locale }>) {
  return (
    <div className="flex w-full translate-y-[4px] items-center gap-4 px-4">
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor="app-message-input">
          {content.message[locale]}
        </label>
        <input
          id="app-message-input"
          type="text"
          readOnly
          placeholder={content.message_placeholder[locale]}
          className="h-[68px] w-full min-w-0 rounded-full bg-[#fdfaf6] px-5 text-[16px] font-semibold text-[#3d2a19] placeholder:text-[#8c7358]"
        />
      </div>
      <SendPawButton locale={locale} />
    </div>
  )
}

function BottomMenuRow() {
  const { openOverlay } = useOverlay()
  const { locale } = useLocale()
  const items = [
    { label: content.my_page[locale], icon: User, overlayType: "my_page" },
    { label: content.quick_menu[locale], icon: MessageCircle },
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

function FooterCats() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute right-6 top-[88px] z-20 flex items-center gap-1.5 text-[#8f5d28]"
    >
      {[0, 1, 2, 3].map((item) => (
        <Cat key={item} className="cat_step h-[14px] w-[14px]" strokeWidth={2.1} />
      ))}
    </div>
  )
}

export default function AppFooter() {
  const [footerMode, setFooterMode] = useState<FooterMode>("normal")
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("bot")
  const { locale } = useLocale()
  const isInputMode = footerMode === "input"

  function toggleFooterMode() {
    setFooterMode((current) => (current === "normal" ? "input" : "normal"))
  }

  return (
    <footer className="fixed inset-x-0 bottom-[-2px] z-50 pb-[env(safe-area-inset-bottom)]">
      <div className={footer_shell_class}>
        <FooterCurve />
        <FooterCats />
        <PinkPawButton
          isInputMode={isInputMode}
          locale={locale}
          onClick={toggleFooterMode}
        />

        <div
          className={[
            "relative z-10 flex h-full flex-col",
            isInputMode ? "" : "pt-[50px] pb-1",
          ].join(" ")}
        >
          <div
            className={[
              "shrink-0 [perspective:1000px]",
              isInputMode
                ? "absolute inset-x-0 bottom-[14px] z-10 h-[92px]"
                : "h-[76px]",
            ].join(" ")}
          >
            <div className="relative h-full w-full [transform-style:preserve-3d]">
              <div
                className={[
                  "absolute inset-0 flex items-start justify-center pt-[23px]",
                  "transition-[transform,opacity] duration-[280ms] ease-out",
                  "[backface-visibility:hidden] [transform-style:preserve-3d]",
                  isInputMode
                    ? "pointer-events-none opacity-0 [transform:translateX(-38px)_rotateY(-58deg)]"
                    : "opacity-100 [transform:translateX(0)_rotateY(0deg)]",
                ].join(" ")}
              >
                <AssistantToggle
                  assistantMode={assistantMode}
                  locale={locale}
                  onChange={setAssistantMode}
                />
              </div>

              <div
                className={[
                  "absolute inset-0 flex flex-col justify-end",
                  "transition-[transform,opacity] duration-[280ms] ease-out",
                  "[backface-visibility:hidden] [transform-style:preserve-3d]",
                  isInputMode
                    ? "opacity-100 [transform:translateX(0)_rotateY(0deg)]"
                    : "pointer-events-none opacity-0 [transform:translateX(38px)_rotateY(58deg)]",
                ].join(" ")}
              >
                <MessageInputRow locale={locale} />
                <CopyrightText />
              </div>
            </div>
          </div>

          {!isInputMode ? (
            <div className="mt-auto h-[102px] shrink-0">
              <BottomMenuRow />
            </div>
          ) : null}
        </div>
      </div>
      <style jsx global>{`
        .cat_step {
          display: inline-block;
          animation: cat_step_blink 1.8s steps(2, end) infinite;
          transform-origin: center bottom;
        }

        .cat_step:nth-child(1) {
          animation-delay: 0s;
        }

        .cat_step:nth-child(2) {
          animation-delay: 0.18s;
        }

        .cat_step:nth-child(3) {
          animation-delay: 0.36s;
        }

        .cat_step:nth-child(4) {
          animation-delay: 0.54s;
        }

        @keyframes cat_step_blink {
          0%,
          70%,
          100% {
            transform: translateY(0) scaleY(1);
            opacity: 1;
          }

          72%,
          76% {
            transform: translateY(1px) scaleY(0.82);
            opacity: 0.92;
          }

          82% {
            transform: translateY(-1px) scaleY(1);
            opacity: 1;
          }
        }
      `}</style>

    </footer>
  )
}
