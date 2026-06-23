"use client"

import { useState } from "react"

import type { DriverPreparationItem } from "@/core/driver/context"

type PreparationResponse = {
  ok?: boolean
  message?: string
  state?: {
    items: DriverPreparationItem[]
    all_ready: boolean
  }
  tier_promoted?: boolean
}

function statusIcon(ready: boolean) {
  return ready ? "✅" : "❌"
}

export default function DriverPreparationChecklist({
  initial_items,
  initial_all_ready,
  tier,
}: Readonly<{
  initial_items: DriverPreparationItem[]
  initial_all_ready: boolean
  tier: string
}>) {
  const [items, setItems] = useState(initial_items)
  const [allReady, setAllReady] = useState(initial_all_ready)
  const [message, setMessage] = useState<string | null>(
    tier === "standard" || initial_all_ready
      ? "稼働準備が完了しました。稼働可能です。"
      : null,
  )
  const [currentTier, setCurrentTier] = useState(tier)

  const [pendingKey, setPendingKey] = useState<string | null>(null)

  async function toggleItem(item: DriverPreparationItem) {
    if (pendingKey || currentTier === "standard") {
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

      if (result.tier_promoted || result.state.all_ready) {
        setCurrentTier("standard")
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

  if (currentTier !== "trainee" && currentTier !== "standard") {
    return null
  }

  return (
    <section className="grid gap-4 rounded-2xl bg-white px-4 py-5 ring-1 ring-neutral-200">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-neutral-900">
          動物のドライバー 必須の準備
        </h2>
        {currentTier === "trainee" ? (
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
              disabled={pendingKey !== null || currentTier === "standard"}
              onClick={() => toggleItem(item)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span aria-hidden="true" className="text-lg leading-none">
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

      {currentTier === "trainee" && allReady ? (
        <p className="text-sm leading-6 text-neutral-600">
          すべての項目が完了しました。ページを再読み込みすると稼働状態が反映されます。
        </p>
      ) : null}
    </section>
  )
}
