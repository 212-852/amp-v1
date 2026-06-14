"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

import AdminStatusDot from "@/components/admin/status_dot"

type AssistantStatus = "idle" | "notification" | "thinking" | "speaking"

const assistant_status_labels: Record<AssistantStatus, string> = {
  idle: "Standby",
  notification: "New alert",
  thinking: "Analyzing",
  speaking: "Responding",
}

const assistant_modes = ["notification", "thinking", "speaking"] as const

type AdminAssistantProps = {
  latest_notification: string
  status?: AssistantStatus
}

export default function AdminAssistant({
  latest_notification,
  status = "notification",
}: Readonly<AdminAssistantProps>) {
  const [is_expanded, set_is_expanded] = useState(false)

  function toggle_expanded() {
    set_is_expanded((current) => !current)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto w-full max-w-[430px]">
        {is_expanded ? (
          <section
            aria-label="roboNeko assistant panel"
            className="max-h-[min(50vh,320px)] overflow-y-auto border-t border-[#e5e5e5] bg-[#ffffff] px-4 pb-3 pt-4 shadow-[0_-10px_28px_rgba(17,17,17,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e5] bg-[#f5f5f5]">
                  <Image
                    src="/images/robo_neko.svg"
                    alt="roboNeko"
                    width={56}
                    height={68}
                    unoptimized
                    className="h-14 w-14 object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-[#111111]">
                    roboNeko Assistant
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-[#777777]">
                    Operations / Dispatch / Support
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Collapse assistant"
                onClick={toggle_expanded}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] text-[#111111]"
              >
                <ChevronDown className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <p className="mt-4 text-[12px] font-medium leading-5 text-[#777777]">
              {latest_notification}
            </p>

            <div className="mt-4 grid gap-2">
              {assistant_modes.map((mode) => (
                <div
                  key={mode}
                  className="flex items-center justify-between rounded-lg border border-[#e5e5e5] px-3 py-2"
                >
                  <span className="text-[11px] font-semibold capitalize text-[#777777]">
                    {mode}
                  </span>
                  <AdminStatusDot active={status === mode} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          aria-label={is_expanded ? "Collapse assistant" : "Expand assistant"}
          aria-expanded={is_expanded}
          onClick={toggle_expanded}
          className="flex w-full items-center gap-3 border-t border-[#e5e5e5] bg-[#ffffff] px-4 py-3 text-left"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#f5f5f5]">
            <Image
              src="/images/robo_neko.svg"
              alt=""
              width={40}
              height={48}
              unoptimized
              className="h-9 w-9 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-bold text-[#111111]">
                roboNeko
              </p>
              <span className="rounded-full border border-[#e5e5e5] px-2 py-0.5 text-[10px] font-semibold text-[#777777]">
                {assistant_status_labels[status]}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] font-medium text-[#777777]">
              {latest_notification}
            </p>
          </div>
          {is_expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-[#777777]" strokeWidth={2} />
          ) : (
            <ChevronUp className="h-4 w-4 shrink-0 text-[#777777]" strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  )
}
