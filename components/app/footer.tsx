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
      className="absolute inset-x-0 bottom-0 h-[166px] w-full text-[#f1ddbf]"
      preserveAspectRatio="none"
      viewBox="0 0 390 166"
    >
      <path
        d="M0 40C45 19 94 18 137 40C166 54 174 67 195 67C216 67 224 54 253 40C296 18 345 19 390 40V166H0V40Z"
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
        "absolute left-4 top-[-12px] z-20 flex h-16 w-16",
        "items-center justify-center rounded-full border border-[#e5cda8]",
        "bg-white shadow-[0_8px_18px_rgba(122,78,34,0.18)]",
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

function MessageInputRow() {
  return (
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

function CopyrightText() {
  return (
    <p className="absolute inset-x-0 bottom-1 text-center text-[10px] font-medium text-[#9b7951]/70">
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
      <div className="relative mx-auto h-[166px] w-full max-w-[430px]">
        <FooterShape />
        <PinkPawButton isInputMode={isInputMode} onClick={toggleFooterMode} />

        <div className="relative flex h-full flex-col justify-end px-5 pb-5 pt-8">
          <div className="relative mb-4 ml-[82px] min-h-14 overflow-hidden [perspective:900px]">
            <div
              aria-hidden={isInputMode}
              className={[
                "absolute inset-0 flex items-center justify-start",
                "transition-[transform,opacity] duration-[260ms] ease-out",
                "[backface-visibility:hidden] [transform-style:preserve-3d]",
                isInputMode
                  ? "pointer-events-none opacity-0 [transform:translateX(-42px)_rotateY(-76deg)]"
                  : "opacity-100 [transform:translateX(0)_rotateY(0deg)]",
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
                "transition-[transform,opacity] duration-[260ms] ease-out",
                "[backface-visibility:hidden] [transform-style:preserve-3d]",
                isInputMode
                  ? "opacity-100 [transform:translateX(0)_rotateY(0deg)]"
                  : "pointer-events-none opacity-0 [transform:translateX(42px)_rotateY(76deg)]",
              ].join(" ")}
            >
              <MessageInputRow />
            </div>
          </div>

          {isInputMode ? null : <BottomMenuRow />}
        </div>

        <CopyrightText />
      </div>
    </footer>
  )
}
