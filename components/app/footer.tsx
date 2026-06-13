"use client"

import { Menu, MessageCircle, PawPrint, User } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

type FooterMode = "normal" | "input"
type AssistantMode = "bot" | "concierge"

const footer_shell_class =
  "relative mx-auto h-[186px] w-full max-w-[430px]"

const pink_paw_button_class = [
  "absolute left-3 top-[-10px] z-30 flex h-[60px] w-[60px]",
  "items-center justify-center rounded-full border border-[#e5cda8]",
  "bg-white shadow-[0_8px_18px_rgba(122,78,34,0.18)]",
  "ring-[5px] ring-[#f1ddbf]",
].join(" ")

function FooterShape() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-[186px] w-full text-[#f1ddbf]"
      preserveAspectRatio="none"
      viewBox="0 0 390 186"
    >
      <path
        d="M0 40C45 19 94 18 137 40C166 54 174 67 195 67C216 67 224 54 253 40C296 18 345 19 390 40V186H0V40Z"
        fill="currentColor"
      />
    </svg>
  )
}

function PinkPawIcon() {
  const [icon_src, set_icon_src] = useState("/images/icon.svg")

  return (
    <Image
      src={icon_src}
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
      priority
      onError={() => {
        set_icon_src((current) =>
          current === "/images/icon.svg" ? "/images/icon.webp" : current,
        )
      }}
    />
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
      className={pink_paw_button_class}
    >
      <PinkPawIcon />
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
    <div className="mx-auto grid h-12 w-full max-w-[340px] grid-cols-2 rounded-full bg-[#e7cfad] p-1">
      <button
        type="button"
        onClick={() => onChange("bot")}
        className={[
          "rounded-full text-[19px] font-semibold leading-none",
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
          "rounded-full text-[19px] font-semibold leading-none",
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
      className="flex h-[58px] w-[52px] shrink-0 items-center justify-center bg-transparent p-0 text-[#7a4e22] shadow-none"
    >
      <PawPrint
        className="h-[52px] w-[52px] fill-[#7a4e22] text-[#7a4e22]"
        strokeWidth={3}
      />
    </button>
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
        className="h-[58px] min-w-0 flex-1 rounded-full bg-[#fffaf2] px-4 text-[16px] font-semibold text-[#3f2d1d] placeholder:text-[#a98964]"
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
      className="grid w-full grid-cols-3 gap-1 text-[#7a5430]"
    >
      {items.map((item) => {
        const Icon = item.icon

        return (
          <button
            key={item.label}
            type="button"
            className="flex flex-col items-center justify-center gap-1 py-1 text-[17px] font-semibold leading-tight"
          >
            <Icon className="h-7 w-7" strokeWidth={2} />
            <span className="text-center">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function CopyrightText() {
  return (
    <p className="py-2 text-center text-[10px] font-medium text-[#9b7951]/70">
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
      <div className={footer_shell_class}>
        <FooterShape />
        <PinkPawButton isInputMode={isInputMode} onClick={toggleFooterMode} />

        <div className="relative flex h-full flex-col px-6 pb-2 pt-[50px]">
          <div className="h-[76px] shrink-0 [perspective:1000px]">
            <div
              className={[
                "relative h-full w-full",
                "transition-transform duration-[280ms] ease-in-out",
                "[transform-style:preserve-3d]",
                isInputMode ? "[transform:rotateY(180deg)]" : "",
              ].join(" ")}
            >
              <div
                className={[
                  "absolute inset-0 flex items-start justify-center pt-7",
                  "[backface-visibility:hidden]",
                ].join(" ")}
              >
                <AssistantToggle
                  assistantMode={assistantMode}
                  onChange={setAssistantMode}
                />
              </div>

              <div
                className={[
                  "absolute inset-0 flex items-start justify-start",
                  "[backface-visibility:hidden] [transform:rotateY(180deg)]",
                ].join(" ")}
              >
                <div className="w-full max-w-[calc(100%-4px)]">
                  <MessageInputRow />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto h-[72px] shrink-0">
            {isInputMode ? <CopyrightText /> : <BottomMenuRow />}
          </div>
        </div>
      </div>
    </footer>
  )
}
