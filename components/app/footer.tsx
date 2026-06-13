"use client"

import {
  ChevronLeft,
  Menu,
  PawPrint,
  Send,
  User,
} from "lucide-react"
import { useState } from "react"

type FooterMode = "normal" | "input"
type AssistantMode = "bot" | "concierge"

function FooterShape() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-[174px] w-full text-[#f3dfc2]"
      preserveAspectRatio="none"
      viewBox="0 0 390 174"
    >
      <path
        d="M0 42C43 22 92 22 132 42C161 57 168 70 195 70C222 70 229 57 258 42C298 22 347 22 390 42V174H0V42Z"
        fill="currentColor"
      />
    </svg>
  )
}

function PawButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Open message input"
      onClick={onClick}
      className="absolute left-1/2 top-0 flex h-[74px] w-[74px] -translate-x-1/2 -translate-y-[18px] items-center justify-center rounded-full bg-white shadow-[0_10px_24px_rgba(105,67,31,0.26)] ring-[7px] ring-[#f3dfc2]"
    >
      <PawPrint
        className="h-[34px] w-[34px] text-[#7a4e22]"
        strokeWidth={2.2}
      />
    </button>
  )
}

export default function AppFooter() {
  const [footerMode, setFooterMode] = useState<FooterMode>("normal")
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("bot")

  if (footerMode === "input") {
    return (
      <footer className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom,0px)]">
        <div className="relative h-[108px] w-full">
          <FooterShape />
          <div className="relative mx-auto flex h-full max-w-[390px] items-end gap-2 px-4 pb-5">
            <button
              type="button"
              aria-label="Back"
              onClick={() => setFooterMode("normal")}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fffaf2] text-[#6a431f] shadow-sm"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2.4} />
            </button>

            <label className="sr-only" htmlFor="app-message-input">
              Message
            </label>
            <input
              id="app-message-input"
              type="text"
              readOnly
              placeholder="Message"
              className="h-12 min-w-0 flex-1 rounded-full bg-[#fffaf2] px-5 text-[15px] font-medium text-[#3f2d1d] shadow-sm placeholder:text-[#a98964]"
            />

            <button
              type="button"
              aria-label="Send"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#7a4e22] text-white shadow-sm"
            >
              <Send className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="relative h-[174px] w-full">
        <FooterShape />
        <PawButton onClick={() => setFooterMode("input")} />

        <div className="relative mx-auto flex h-full max-w-[390px] flex-col px-5 pb-3 pt-[58px]">
          <div className="grid grid-cols-[1fr_92px_1fr] items-start">
            <button
              type="button"
              className="flex h-12 items-center justify-start gap-2 rounded-full px-1 text-[13px] font-black text-[#6a431f]"
            >
              <User className="h-5 w-5" strokeWidth={2.1} />
              My Page
            </button>

            <div aria-hidden="true" />

            <button
              type="button"
              className="flex h-12 items-center justify-end gap-2 rounded-full px-1 text-[13px] font-black text-[#6a431f]"
            >
              Menu
              <Menu className="h-5 w-5" strokeWidth={2.2} />
            </button>
          </div>

          <div className="mx-auto mt-2 grid h-9 w-full max-w-[240px] grid-cols-2 rounded-full bg-[#e5caa8] p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setAssistantMode("bot")}
              className={[
                "rounded-full text-[12px] font-black",
                assistantMode === "bot"
                  ? "bg-[#7a4e22] text-white shadow-sm"
                  : "text-[#6a431f]",
              ].join(" ")}
            >
              Bot
            </button>
            <button
              type="button"
              onClick={() => setAssistantMode("concierge")}
              className={[
                "rounded-full text-[12px] font-black",
                assistantMode === "concierge"
                  ? "bg-[#7a4e22] text-white shadow-sm"
                  : "text-[#6a431f]",
              ].join(" ")}
            >
              Concierge
            </button>
          </div>

          <p className="mt-auto text-center text-[10px] font-bold text-[#9b7951]">
            Copyright 2026 PET TAXI
          </p>
        </div>
      </div>
    </footer>
  )
}
