"use client"

import { useState } from "react"

type footer_mode = "normal" | "input"
type chat_mode = "bot" | "concierge"

function PawIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="currentColor"
    >
      <circle cx="7" cy="8" r="2.2" />
      <circle cx="12" cy="6" r="2.2" />
      <circle cx="17" cy="8" r="2.2" />
      <circle cx="9.5" cy="12.5" r="2" />
      <circle cx="14.5" cy="12.5" r="2" />
      <path d="M8.5 16.5c1.2 2.2 5.8 2.2 7 0 1.1-2 0.6-3.8-1.2-4.5-1.2-.5-2.4-.5-4.6 0-1.8.7-2.3 2.5-1.2 4.5z" />
    </svg>
  )
}

function BackIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export default function AppFooter() {
  const [footer_mode, set_footer_mode] = useState<footer_mode>("normal")
  const [chat_mode, set_chat_mode] = useState<chat_mode>("bot")

  if (footer_mode === "input") {
    return (
      <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e8d8c3] bg-[#f6e5cf] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex w-full max-w-[430px] items-center gap-2 px-4 py-3">
          <button
            type="button"
            aria-label="Back to menu"
            onClick={() => set_footer_mode("normal")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#d9c5a8] bg-white text-[#5c4835]"
          >
            <BackIcon />
          </button>

          <label className="sr-only" htmlFor="app_message_input">
            Message
          </label>
          <input
            id="app_message_input"
            type="text"
            readOnly
            placeholder="Type a message"
            className="h-11 min-w-0 flex-1 rounded-full border border-[#d9c5a8] bg-white px-4 text-sm text-[#3d2f24] placeholder:text-[#b0987d]"
          />

          <button
            type="button"
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8b6f47] text-white"
          >
            <PawIcon />
          </button>
        </div>
      </footer>
    )
  }

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e8d8c3] bg-[#f6e5cf] pb-[env(safe-area-inset-bottom,0px)]">
      <div className="mx-auto w-full max-w-[430px] px-4 pt-3">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => set_chat_mode("bot")}
            className={[
              "h-9 rounded-full border text-sm font-bold",
              chat_mode === "bot"
                ? "border-[#8b6f47] bg-[#8b6f47] text-white"
                : "border-[#d9c5a8] bg-white text-[#6f573d]",
            ].join(" ")}
          >
            Bot
          </button>
          <button
            type="button"
            onClick={() => set_chat_mode("concierge")}
            className={[
              "h-9 rounded-full border text-sm font-bold",
              chat_mode === "concierge"
                ? "border-[#8b6f47] bg-[#8b6f47] text-white"
                : "border-[#d9c5a8] bg-white text-[#6f573d]",
            ].join(" ")}
          >
            Concierge
          </button>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pb-2">
          <button
            type="button"
            className="justify-self-start rounded-full border border-[#d9c5a8] bg-white px-4 py-2 text-sm font-bold text-[#6f573d]"
          >
            My Page
          </button>

          <button
            type="button"
            aria-label="Open message input"
            onClick={() => set_footer_mode("input")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[#8b6f47] text-white"
          >
            <PawIcon />
          </button>

          <button
            type="button"
            className="justify-self-end rounded-full border border-[#d9c5a8] bg-white px-4 py-2 text-sm font-bold text-[#6f573d]"
          >
            Menu
          </button>
        </div>

        <p className="pb-3 text-center text-[10px] font-medium text-[#9a8468]">
          Copyright {new Date().getFullYear()} PET TAXI
        </p>
      </div>
    </footer>
  )
}
