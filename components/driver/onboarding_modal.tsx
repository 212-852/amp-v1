"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import type { DriverPreparationItem, DriverStatus } from "@/core/driver/context"
import {
  count_preparation_progress,
  DRIVER_PREPARATION_KEYS,
} from "@/core/driver/rules"

type PreparationResponse = {
  ok?: boolean
  message?: string
  state?: {
    status: DriverStatus
    items: DriverPreparationItem[]
    all_ready: boolean
  }
  status_activated?: boolean
}

function statusLabel(ready: boolean) {
  return ready ? "✓ 完了" : "✕ 未完了"
}

export default function DriverOnboardingModal({
  initial_items,
  initial_status,
}: Readonly<{
  initial_items: DriverPreparationItem[]
  initial_status: DriverStatus
}>) {
  const router = useRouter()
  const [items, setItems] = useState(initial_items)
  const [status, setStatus] = useState(initial_status)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const completed_count = count_preparation_progress(items)
  const total_count = DRIVER_PREPARATION_KEYS.length

  if (status !== "provisional") {
    return null
  }

  async function toggleItem(item: DriverPreparationItem) {
    if (pendingKey) {
      return
    }

    const nextReady = !item.ready

    setPendingKey(item.key)

    try {
      const response = await fetch("/api/driver/preparation", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: item.key,
          ready: nextReady,
        }),
      })
      const result = (await response.json().catch(() => null)) as
        | PreparationResponse
        | null

      if (!response.ok || result?.ok !== true || !result.state) {
        setMessage(result?.message ?? "更新できませんでした。")
        return
      }

      setItems(result.state.items)
      setStatus(result.state.status)
      setMessage(result.message ?? null)

      if (result.status_activated || result.state.status === "active") {
        router.refresh()
      }
    } catch {
      setMessage("更新できませんでした。")
    } finally {
      setPendingKey(null)
    }
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
          {items.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                disabled={pendingKey !== null}
                onClick={() => toggleItem(item)}
                className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-left transition hover:bg-neutral-50 disabled:cursor-wait disabled:opacity-70"
              >
                <span
                  aria-hidden="true"
                  className={[
                    "shrink-0 text-sm font-bold",
                    item.ready ? "text-[#1f6b3b]" : "text-[#b42318]",
                  ].join(" ")}
                >
                  {statusLabel(item.ready)}
                </span>
                <span className="text-[15px] font-medium leading-6 text-neutral-900">
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {message ? (
          <p className="mx-5 mb-4 rounded-xl bg-[#eef9f0] px-3 py-3 text-sm font-medium leading-6 text-[#1f6b3b]">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
