"use client"

import { Menu, MessageCircle, PawPrint, User } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

type FooterMode = "normal" | "input"
type AssistantMode = "bot" | "concierge"

function FooterShape({ tall = false }: { tall?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={[
        "absolute inset-x-0 bottom-0 w-full text-[#f1ddbf]",
        tall ? "h-[198px]" : "h-[178px]",
      ].join(" ")}
      preserveAspectRatio="none"
      viewBox="0 0 390 198"
    >
      <path
        d="M0 40C45 19 94 18 137 40C166 54 174 67 195 67C216 67 224 54 253 40C296 18 345 19 390 40V198H0V40Z"
        fill="currentColor"
      />
    </svg>
  )
}

function PinkPawButton({
  isInputMode,
  onClick,
}: {
  isInputMode: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={isInputMode ? "Close message input" : "Open message input"}
      aria-pressed={isInputMode}
      onClick={onClick}
      className={[
        "absolute left-3 top-0 z-30 flex h-[60px] w-[60px]",
        "-translate-y-[10px] items-center justify-center rounded-full",
        "border border-[#e5cda8] bg-white",
        "shadow-[0_8px_18px_rgba(122,78,34,0.18)] ring-[5px] ring-[#f1ddbf]",
      ].join(" ")}
    >
      <Image
        src="/icons/paw.svg"
        alt=""
        width={40}
        height={40}
        className="h-10 w-10"
        priority
      />
    </button>
  )
}

function AssistantToggle({
  assistantMode,
  onChange,
}: {
  assistantMode: AssistantMode
  onChange: (mode: AssistantMode) => void
}) {
  return (
    <div className="mx-auto grid h-12 w-full max-w-[320px] grid-cols-2 rounded-full bg-[#e7cfad] p-1">
      <button
        type="button"
        onClick={() => onChange("bot")}
        className={[
          "rounded-full text-[18px] font-semibold leading-none",
          assistantMode === "bot"
            ? "bg-[#7a4e22] text-white"
            : "text-[#7a5430]",
        ].join(" ")}
      >
        Bot
      </button>
      <button
        type="button"
        onClick={() => onChange("concierge")}
        className={[
          "rounded-full text-[18px] font-semibold leading-none",
          assistantMode === "concierge"
            ? "bg-[#7a4e22] text-white"
            : "text-[#7a5430]",
        ].join(" ")}
      >
        Concierge
      </button>
    </div>
  )
}

function SendPawButton() {
  return (
    <button
      type="button"
      aria-label="Send"
      className="flex h-[60px] w-[52px] shrink-0 items-center justify-center bg-transparent p-0 text-[#7a4e22]"
    >
      <PawPrint
        className="h-12 w-12 fill-[#7a4e22] text-[#7a4e22]"
        strokeWidth={2.8}
      />
    </button>
  )
}

function MessageInputRow() {
  return (
    <div className="flex w-full items-center gap-1 px-0.5">
      <label className="sr-only" htmlFor="app-message-input">
        Message
      </label>
      <input
        id="app-message-input"
        type="text"
        readOnly
        placeholder="メッセージを入力"
        className="h-[60px] min-w-0 flex-1 rounded-full bg-[#fffaf2] px-4 text-[16px] font-semibold text-[#3f2d1d] placeholder:text-[#a98964]"
      />
      <SendPawButton />
    </div>
  )
}

function BottomMenuRow() {
  const items = [
    { label: "My Page", icon: User },
    { label: "Quick Menu", icon: MessageCircle },
    { label: "Menu", icon: Menu },
  ]

  return (
    <nav
      aria-label="Footer menu"
      className="grid w-full grid-cols-3 gap-2 px-1 text-[#7a5430]"
    >
      {items.map((item) => {
        const Icon = item.icon

        return (
          <button
            key={item.label}
            type="button"
            className="flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold"
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
            <span className="text-center leading-tight">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function CopyrightText() {
  return (
    <p className="py-1 text-center text-[10px] font-medium text-[#9b7951]">
      © 2026 Wan Da Nya Inc.
    </p>
  )
}

export default function AppFooter() {
  const [footerMode, setFooterMode] = useState<FooterMode>("normal")
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("bot")
  const isInputMode = footerMode === "input"

  function toggleFooterMode() {
    setFooterMode((current) => (current === "normal" ? "input" : "normal"))
  }

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div
        className={[
          "relative mx-auto w-full max-w-[430px]",
          isInputMode ? "h-[198px]" : "h-[178px]",
        ].join(" ")}
      >
        <FooterShape tall={isInputMode} />
        <PinkPawButton isInputMode={isInputMode} onClick={toggleFooterMode} />

        <div className="relative flex h-full flex-col px-2 pb-1 pt-[52px]">
          <div className="min-h-[108px] flex-1 [perspective:1000px]">
            <div
              className={[
                "relative h-full transition-transform duration-300 ease-in-out",
                "[transform-style:preserve-3d]",
                isInputMode ? "[transform:rotateY(180deg)]" : "",
              ].join(" ")}
            >
              <div
                className={[
                  "absolute inset-0 flex flex-col justify-start gap-3",
                  "[backface-visibility:hidden]",
                ].join(" ")}
              >
                <AssistantToggle
                  assistantMode={assistantMode}
                  onChange={setAssistantMode}
                />
                <BottomMenuRow />
              </div>

              <div
                className={[
                  "absolute inset-0 flex flex-col justify-start",
                  "[backface-visibility:hidden] [transform:rotateY(180deg)]",
                ].join(" ")}
              >
                <MessageInputRow />
              </div>
            </div>
          </div>

          {isInputMode ? (
            <div className="mt-auto flex flex-col gap-2">
              <CopyrightText />
              <AssistantToggle
                assistantMode={assistantMode}
                onChange={setAssistantMode}
              />
            </div>
          ) : (
            <div className="mt-auto">
              <CopyrightText />
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}
