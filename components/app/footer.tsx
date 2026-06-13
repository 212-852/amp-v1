"use client"

import { Grid2X2, Menu, PawPrint, User } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

type FooterMode = "normal" | "input"
type AssistantMode = "bot" | "concierge"

function FooterShape() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-[158px] w-full text-[#f1ddbf]"
      preserveAspectRatio="none"
      viewBox="0 0 390 158"
    >
      <path
        d="M0 36C45 18 94 17 137 36C166 49 174 62 195 62C216 62 224 49 253 36C296 17 345 18 390 36V158H0V36Z"
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
        "absolute left-4 top-[-12px] z-20 flex h-[64px] w-[64px]",
        "items-center justify-center rounded-full",
        "border border-[#e5cda8] bg-white shadow-[0_8px_18px_rgba(122,78,34,0.18)]",
        "ring-[5px] ring-[#f1ddbf]",
      ].join(" ")}
    >
      <Image
        src="/images/icon.svg"
        alt=""
        width={42}
        height={42}
        className="h-[42px] w-[42px]"
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
    <div className="grid h-10 w-full max-w-[252px] grid-cols-2 rounded-full bg-[#e7cfad] p-1">
      <button
        type="button"
        onClick={() => onChange("bot")}
        className={[
          "rounded-full text-[14px] font-semibold transition-opacity duration-150",
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
          "rounded-full text-[14px] font-semibold transition-opacity duration-150",
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
      className="flex w-full items-end justify-between px-1 text-[#7a5430]"
    >
      {items.map((item) => {
        const Icon = item.icon

        return (
          <button
            key={item.label}
            type="button"
            className="flex min-w-[76px] flex-col items-center justify-center gap-1 py-1.5 text-[11px] font-semibold"
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
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
      <div className="relative mx-auto h-[158px] w-full max-w-[390px]">
        <FooterShape />
        <PawToggle isInputMode={isInputMode} onClick={toggleFooterMode} />

        <div className="relative flex h-full flex-col justify-end px-5 pb-2 pt-7">
          <div
            className={[
              "relative overflow-hidden",
              isInputMode
                ? "mb-8 ml-[78px] min-h-14"
                : "mb-4 ml-[82px] min-h-12",
            ].join(" ")}
          >
            <div
              aria-hidden={isInputMode}
              className={[
                "absolute inset-0 flex items-center justify-start",
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
                  className="h-14 min-w-0 flex-1 rounded-full bg-[#fffaf2] px-5 text-[15px] font-semibold text-[#3f2d1d] shadow-sm placeholder:text-[#a98964]"
                />
                <button
                  type="button"
                  aria-label="Send"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#7a4e22] text-white shadow-[0_7px_16px_rgba(122,78,34,0.24)]"
                >
                  <PawPrint className="h-7 w-7" strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>

          {isInputMode ? null : <BottomMenuRow />}
        </div>
      </div>
    </footer>
  )
}
