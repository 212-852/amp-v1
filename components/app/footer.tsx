"use client"

import { Grid2X2, Menu, Send, User } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

type FooterMode = "normal" | "input"
type AssistantMode = "bot" | "concierge"

function FooterShape() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-[150px] w-full text-[#f1ddbf]"
      preserveAspectRatio="none"
      viewBox="0 0 390 150"
    >
      <path
        d="M0 32C45 16 94 15 137 32C166 44 174 56 195 56C216 56 224 44 253 32C296 15 345 16 390 32V150H0V32Z"
        fill="currentColor"
      />
    </svg>
  )
}

function PawToggle({
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
        "absolute left-4 top-[-14px] z-20 flex h-[62px] w-[62px]",
        "items-center justify-center rounded-full",
        "bg-white shadow-[0_8px_18px_rgba(122,78,34,0.16)]",
        "ring-[5px] ring-[#f1ddbf]",
      ].join(" ")}
    >
      <Image
        src="/images/icon.svg"
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
    <div className="grid h-9 w-full max-w-[218px] grid-cols-2 rounded-full bg-[#e7cfad] p-1">
      <button
        type="button"
        onClick={() => onChange("bot")}
        className={[
          "rounded-full text-[12px] font-semibold transition-opacity duration-150",
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
          "rounded-full text-[12px] font-semibold transition-opacity duration-150",
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

function BottomMenuRow() {
  const items = [
    { label: "My Page", icon: User },
    { label: "Quick Menu", icon: Grid2X2 },
    { label: "Menu", icon: Menu },
  ]

  return (
    <nav
      aria-label="Footer menu"
      className="grid grid-cols-3 items-end text-[#7a5430]"
    >
      {items.map((item) => {
        const Icon = item.icon

        return (
          <button
            key={item.label}
            type="button"
            className="flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-semibold"
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
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
      <div className="relative mx-auto h-[150px] w-full max-w-[390px]">
        <FooterShape />
        <PawToggle isInputMode={isInputMode} onClick={toggleFooterMode} />

        <div className="relative flex h-full flex-col justify-end px-5 pb-2 pt-7">
          <div className="relative mb-3 min-h-12 overflow-hidden pl-[74px]">
            <div
              aria-hidden={isInputMode}
              className={[
                "absolute inset-0 flex items-center justify-center",
                "transition-[transform,opacity] duration-200 ease-out",
                isInputMode
                  ? "-translate-x-8 opacity-0 pointer-events-none"
                  : "translate-x-0 opacity-100",
              ].join(" ")}
            >
              <AssistantToggle
                assistantMode={assistantMode}
                onChange={setAssistantMode}
              />
            </div>

            <div
              aria-hidden={!isInputMode}
              className={[
                "absolute inset-0 flex items-center",
                "transition-[transform,opacity] duration-200 ease-out",
                isInputMode
                  ? "translate-x-0 opacity-100"
                  : "translate-x-8 opacity-0 pointer-events-none",
              ].join(" ")}
            >
              <div className="flex w-full items-center gap-2">
                <label className="sr-only" htmlFor="app-message-input">
                  Message
                </label>
                <input
                  id="app-message-input"
                  type="text"
                  readOnly
                  placeholder="メッセージを入力"
                  className="h-11 min-w-0 flex-1 rounded-full bg-[#fffaf2] px-4 text-[14px] font-medium text-[#3f2d1d] placeholder:text-[#a98964]"
                />
                <button
                  type="button"
                  aria-label="Send"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#7a4e22] text-white"
                >
                  <Send className="h-5 w-5" strokeWidth={2.1} />
                </button>
              </div>
            </div>
          </div>

          <BottomMenuRow />
        </div>
      </div>
    </footer>
  )
}
