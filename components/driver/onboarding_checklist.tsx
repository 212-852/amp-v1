"use client"

import { memo, useCallback } from "react"
import { useRouter } from "next/navigation"

import DriverTaskModal from "@/components/driver/driver_task_modal"
import OnboardingTaskCard from "@/components/driver/onboarding_task_card"
import { use_driver_preparation } from "@/components/driver/preparation_provider"
import type { DriverOnboardingTaskKey } from "@/core/driver/context"

export default function DriverOnboardingChecklist() {
  const router = useRouter()
  const {
    items,
    all_complete,
    active_task,
    open_task,
    request_driver_refresh,
  } = use_driver_preparation()

  function start_work() {
    if (!request_driver_refresh("start_work")) {
      return
    }

    router.refresh()
  }

  return (
    <>
      <div className="pb-10 pt-2">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            稼働準備
          </h1>
          <p className="text-sm leading-6 text-neutral-600">
            すべての準備が完了すると、ドライバーとして稼働できます。
          </p>
        </header>

        <section className="mt-8 space-y-3" aria-label="準備項目一覧">
          {items.map((item) => (
            <MemoizedTaskCard
              key={item.key}
              item={item}
              open_task={open_task}
            />
          ))}
        </section>

        <div className="mt-8">
          <button
            type="button"
            disabled={!all_complete}
            onClick={start_work}
            className="h-12 w-full rounded-full bg-neutral-900 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
          >
            仕事を開始する
          </button>
        </div>
      </div>

      {active_task ? <DriverTaskModal task_key={active_task} /> : null}
    </>
  )
}

const MemoizedTaskCard = memo(function MemoizedTaskCard({
  item,
  open_task,
}: Readonly<{
  item: Parameters<typeof OnboardingTaskCard>[0]["item"]
  open_task: (key: DriverOnboardingTaskKey) => void
}>) {
  const on_open = useCallback(() => {
    open_task(item.key)
  }, [item.key, open_task])

  return <OnboardingTaskCard item={item} on_open={on_open} />
})
