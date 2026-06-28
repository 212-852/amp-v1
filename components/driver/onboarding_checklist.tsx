"use client"

import { useRouter } from "next/navigation"

import OnboardingTaskCard from "@/components/driver/onboarding_task_card"
import type { DriverChecklistItem } from "@/core/driver/context"

export default function DriverOnboardingChecklist({
  items,
  completed_count,
  total_count,
  all_complete,
}: Readonly<{
  items: DriverChecklistItem[]
  completed_count: number
  total_count: number
  all_complete: boolean
}>) {
  const router = useRouter()
  const remaining_count = Math.max(0, total_count - completed_count)
  const progress_percent =
    total_count > 0 ? Math.round((completed_count / total_count) * 100) : 0

  return (
    <main className="min-h-dvh bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto flex w-full max-w-lg flex-col px-5 pb-10 pt-8">
        <header className="space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
              稼働準備
            </h1>
            <p className="text-sm leading-6 text-neutral-600">
              すべての準備が完了すると、ドライバーとして稼働できます。
            </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex items-end justify-between gap-3">
              <p className="text-sm font-semibold text-neutral-900">
                進捗 {completed_count} / {total_count}
              </p>
              <p className="text-sm font-semibold text-neutral-700">
                {progress_percent}%
              </p>
            </div>

            <div
              className="h-2 overflow-hidden rounded-full bg-neutral-100"
              role="progressbar"
              aria-valuenow={progress_percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="稼働準備の進捗"
            >
              <div
                className="h-full rounded-full bg-neutral-900 transition-[width] duration-500 ease-out"
                style={{ width: `${progress_percent}%` }}
              />
            </div>

            {remaining_count > 0 ? (
              <p className="text-sm text-neutral-600">
                あと{remaining_count}項目で稼働できます
              </p>
            ) : (
              <p className="text-sm font-medium text-emerald-700">
                すべての準備が完了しました
              </p>
            )}
          </div>
        </header>

        <section className="mt-8 space-y-3" aria-label="準備項目一覧">
          {items.map((item) => (
            <OnboardingTaskCard key={item.key} item={item} />
          ))}
        </section>

        <div className="mt-8">
          <button
            type="button"
            disabled={!all_complete}
            onClick={() => router.refresh()}
            className="h-12 w-full rounded-full bg-neutral-900 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            ドライバー画面へ進む
          </button>
        </div>
      </div>
    </main>
  )
}
