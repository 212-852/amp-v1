"use client"

import { X } from "lucide-react"
import { useCallback } from "react"

import { useDriverPreparation } from "@/components/driver/preparation_provider"
import DriverLicenseTask from "@/components/driver/tasks/license"
import DriverOperatorTask from "@/components/driver/tasks/operator"
import DriverSafetyTask from "@/components/driver/tasks/safety"
import DriverVehicleTask from "@/components/driver/tasks/vehicle"
import type { DriverOnboardingTaskKey } from "@/core/driver/context"
import { DRIVER_PROGRESS_LABELS } from "@/core/driver/progress/rules"

function render_task_body(input: {
  active_task: DriverOnboardingTaskKey
  request_id: string
  component_instance_id: string
  on_saved: () => void
}) {
  if (input.active_task === "driver_license") {
    return (
      <DriverLicenseTask
        request_id={input.request_id}
        component_instance_id={input.component_instance_id}
        on_saved={input.on_saved}
      />
    )
  }
  if (input.active_task === "freight_operator") {
    return <DriverOperatorTask on_saved={input.on_saved} />
  }
  if (input.active_task === "safety_manager") {
    return <DriverSafetyTask on_saved={input.on_saved} />
  }
  return <DriverVehicleTask on_saved={input.on_saved} />
}

export default function DriverTaskModal({
  active_task,
  request_id,
  component_instance_id,
  on_close,
}: Readonly<{
  active_task: DriverOnboardingTaskKey | null
  request_id: string
  component_instance_id: string
  on_close: (reason: string) => void
}>) {
  const { get_item } = useDriverPreparation()
  const handle_saved = useCallback(() => {
    on_close("save_completed")
  }, [on_close])
  if (!active_task) return null

  const item = get_item(active_task)
  const title = item?.label ?? DRIVER_PROGRESS_LABELS[active_task]

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="driver-task-modal-title">
      <div className="flex max-h-[min(92dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_24px_64px_rgba(0,0,0,0.35)] sm:rounded-3xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">稼働準備</p>
            <h2 id="driver-task-modal-title" className="mt-1 text-lg font-bold leading-7 text-neutral-950">{title}</h2>
          </div>
          <button type="button" aria-label="閉じる" onClick={() => on_close("user_close")} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50">
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {render_task_body({
            active_task,
            request_id,
            component_instance_id,
            on_saved: handle_saved,
          })}
        </div>

        <footer className="border-t border-neutral-200 px-5 py-4">
          <button type="button" onClick={() => on_close("user_cancel")} className="h-11 w-full rounded-full border border-neutral-300 text-sm font-semibold text-neutral-800">
            {active_task === "driver_license" ? "キャンセル" : "閉じる"}
          </button>
        </footer>
      </div>
    </div>
  )
}
