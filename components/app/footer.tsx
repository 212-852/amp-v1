"use client"

import { Send } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

type FooterMode = "normal" | "input"
type AssistantMode = "bot" | "concierge"

function FooterShape() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-[148px] w-full text-[#f3dfc2]"
      preserveAspectRatio="none"
      viewBox="0 0 390 148"
    >
      <path
        d="M0 34C48 16 98 16 142 34C168 46 176 58 195 58C214 58 222 46 248 34C292 16 342 16 390 34V148H0V34Z"
        fill="currentColor"
      />
    </svg>
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
    <div className="mx-auto grid h-8 w-full max-w-[220px] grid-cols-2 rounded-full bg-[#e8d2b3] p-0.5">
      <button
        type="button"
        onClick={() => onChange("bot")}
        className={[
          "rounded-full text-[11px] font-semibold tracking-wide",
          assistantMode === "bot"
            ? "bg-[#7a4e22] text-white"
            : "text-[#8b6848]",
        ].join(" ")}
      >
        Bot
      </button>
      <button
        type="button"
        onClick={() => onChange("concierge")}
        className={[
          "rounded-full text-[11px] font-semibold tracking-wide",
          assistantMode === "concierge"
            ? "bg-[#7a4e22] text-white"
            : "text-[#8b6848]",
        ].join(" ")}
      >
        Concierge
      </button>
    </div>
  )
}

function BottomMenuRow() {
  return (
    <nav
      aria-label="Footer menu"
      className="grid grid-cols-3 items-center px-1 pt-1 text-[11px] font-semibold tracking-wide text-[#7a5430]"
    >
      <button type="button" className="py-2 text-center">
        My Page
      </button>
      <button type="button" className="py-2 text-center">
        Quick Menu
      </button>
      <button type="button" className="py-2 text-center">
        Menu
      </button>
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
    <footer className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom,0px)]">
      <div className="relative mx-auto h-[148px] w-full max-w-[390px]">
        <FooterShape />

        <button
          type="button"
          aria-label={isInputMode ? "Close message input" : "Open message input"}
          aria-pressed={isInputMode}
          onClick={toggleFooterMode}
          className="absolute left-3 top-0 z-20 flex h-[62px] w-[62px] -translate-y-[14px] items-center justify-center rounded-full bg-white shadow-[0_8px_20px_rgba(122,78,34,0.18)] ring-[5px] ring-[#f3dfc2]"
        >
          <Image
            src="/icons/paw.svg"
            alt=""
            width={38}
            height={38}
            className="h-[38px] w-[38px]"
            priority
          />
        </button>

        <div className="relative flex h-full flex-col justify-end px-4 pb-1 pt-7">
          <div className="mb-2 min-h-[72px] [perspective:900px]">
            <div
              className={[
                "relative min-h-[72px] transition-transform duration-300 ease-out",
                "[transform-style:preserve-3d]",
                isInputMode ? "[transform:rotateX(180deg)]" : "",
              ].join(" ")}
            >
              <div
                className={[
                  "absolute inset-0 flex flex-col justify-center",
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
                  "absolute inset-0 flex flex-col justify-center gap-2",
                  "[backface-visibility:hidden] [transform:rotateX(180deg)]",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 pl-[58px]">
                  <label className="sr-only" htmlFor="app-message-input">
                    Message
                  </label>
                  <input
                    id="app-message-input"
                    type="text"
                    readOnly
                    placeholder="メッセージを入力"
                    className="h-10 min-w-0 flex-1 rounded-full bg-[#fffaf2] px-4 text-[14px] text-[#3f2d1d] placeholder:text-[#b0987d]"
                  />
                  <button
                    type="button"
                    aria-label="Send"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7a4e22] text-white"
                  >
                    <Send className="h-4 w-4" strokeWidth={2.2} />
                  </button>
                </div>
                <AssistantToggle
                  assistantMode={assistantMode}
                  onChange={setAssistantMode}
                />
              </div>
            </div>
          </div>

          <BottomMenuRow />
        </div>
      </div>
    </footer>
  )
}
