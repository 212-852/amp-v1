"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, type ReactNode } from "react"

import DriverLicenseAccordionPanel from "@/components/driver/license_accordion_panel"
import type {
  DriverChecklistItem,
  DriverProgressKey,
  DriverStatus,
} from "@/core/driver/context"

function ProgressStatusIcon({ complete }: Readonly<{ complete: boolean }>) {
  if (complete) {
    return (
      <CheckCircle2
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-emerald-600"
        strokeWidth={2.25}
      />
    )
  }

  return (
    <XCircle
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-red-600"
      strokeWidth={2.25}
    />
  )
}

function AccordionPanel({
  expanded,
  children,
}: Readonly<{
  expanded: boolean
  children: ReactNode
}>) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
      style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

function PlaceholderPanel({ label }: Readonly<{ label: string }>) {
  return (
    <div className="border-t border-neutral-100 px-4 pb-4 pt-3">
      <p className="text-sm leading-6 text-neutral-600">
        {label}の登録は準備中です。
      </p>
    </div>
  )
}

export default function DriverOnboardingModal({
  initial_items,
  initial_status,
  completed_count,
  total_count,
}: Readonly<{
  initial_items: DriverChecklistItem[]
  initial_status: DriverStatus
  completed_count: number
  total_count: number
}>) {
  const router = useRouter()
  const [expanded_key, setExpandedKey] = useState<DriverProgressKey | null>(null)
  const item_refs = useRef<Partial<Record<DriverProgressKey, HTMLLIElement | null>>>({})

  useEffect(() => {
    if (!expanded_key) {
      return
    }

    const node = item_refs.current[expanded_key]

    if (!node) {
      return
    }

    window.requestAnimationFrame(() => {
      node.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      })
    })
  }, [expanded_key])

  if (initial_status !== "provisional") {
    return null
  }

  function toggle_item(key: DriverProgressKey) {
    setExpandedKey((current) => (current === key ? null : key))
  }

  function handleLicenseComplete() {
    router.refresh()
  }

  function render_panel(item: DriverChecklistItem) {
    if (item.key === "driver_license") {
      const latest_entry = item.latest_entry?.image_url ? item.latest_entry : null

      return (
        <DriverLicenseAccordionPanel
          current_answer={item.current_answer ?? "未回答"}
          initial_entry={latest_entry}
          onComplete={handleLicenseComplete}
        />
      )
    }

    return <PlaceholderPanel label={item.label} />
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-onboarding-title"
    >
      <div className="flex max-h-[min(720px,100dvh)] w-full max-w-[430px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_64px_rgba(0,0,0,0.35)]">
        <div className="border-b border-neutral-200 px-5 py-5">
          <h2
            id="driver-onboarding-title"
            className="text-lg font-bold text-neutral-950"
          >
            稼働準備
          </h2>
          <p className="mt-1 text-sm leading-6 text-neutral-600">
            すべての準備が完了すると、ドライバー画面が利用できます。
          </p>
          <p className="mt-3 text-sm font-semibold text-neutral-900">
            進捗 {completed_count}/{total_count}
          </p>
        </div>

        <ul className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {(initial_items ?? []).map((item) => {
            const expanded = expanded_key === item.key

            return (
              <li
                key={item.key}
                ref={(node) => {
                  item_refs.current[item.key] = node
                }}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
              >
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => toggle_item(item.key)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-50"
                >
                  <ProgressStatusIcon complete={item.complete} />
                  <span className="text-[15px] font-medium leading-6 text-neutral-900">
                    {item.label}
                  </span>
                </button>

                <AccordionPanel expanded={expanded}>{render_panel(item)}</AccordionPanel>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
