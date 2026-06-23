"use client"

import { useState } from "react"

import type { DriverPreparationItem, DriverStatus } from "@/core/driver/context"

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

function statusIcon(ready: boolean) {
  return ready ? "✓" : "✕"
}

export default function DriverPreparationChecklist({
  initial_items,
  initial_all_ready,
  initial_status,
}: Readonly<{
  initial_items: DriverPreparationItem[]
  initial_all_ready: boolean
  initial_status: DriverStatus
}>) {
  const [items, setItems] = useState(initial_items)
  const [allReady, setAllReady] = useState(initial_all_ready)
  const [status, setStatus] = useState(initial_status)
  const [message, setMessage] = useState<string | null>(
    initial_status === "active" || initial_all_ready
      ? "稼働準備が完了しました。稼働可能です。"
      : null,
  )
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  async function toggleItem(item: DriverPreparationItem) {
    if (pendingKey || status !== "preparing") {
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
      setAllReady(result.state.all_ready)
      setStatus(result.state.status)

      if (result.status_activated || result.state.status === "active") {
        setMessage("稼働準備が完了しました。稼働可能です。")
        return
      }

      setMessage(result.message ?? null)
    } catch {
      setMessage("更新できませんでした。")
    } finally {
      setPendingKey(null)
    }
  }

  if (status !== "preparing" && status !== "active") {
    return null
  }

  return (
    <section className="grid gap-4 rounded-2xl bg-white px-4 py-5 ring-1 ring-neutral-200">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-neutral-900">
          動物のドライバー 必須の準備
        </h2>
        {status === "preparing" ? (
          <p className="text-sm leading-6 text-neutral-600">
            すべての準備が完了すると稼働可能になります。
          </p>
        ) : null}
      </div>

      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              disabled={pendingKey !== null || status !== "preparing"}
              onClick={() => toggleItem(item)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span
                aria-hidden="true"
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold leading-none",
                  item.ready
                    ? "bg-[#eef9f0] text-[#1f6b3b]"
                    : "bg-[#fff1f1] text-[#b42318]",
                ].join(" ")}
              >
                {statusIcon(item.ready)}
              </span>
              <span className="font-medium">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {message ? (
        <p className="rounded-xl bg-[#eef9f0] px-3 py-3 text-sm font-medium leading-6 text-[#1f6b3b]">
          {message}
        </p>
      ) : null}
    </section>
  )
}
