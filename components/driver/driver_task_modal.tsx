"use client"

import { X } from "lucide-react"
import { useCallback } from "react"

import DriverLicenseTaskModalContent from "@/components/driver/license_task_modal_content"
import { use_driver_preparation } from "@/components/driver/preparation_provider"
import DriverTaskPlaceholderModalContent from "@/components/driver/task_placeholder_modal_content"
import {
  DRIVER_PROGRESS_LABELS,
  type DriverOnboardingTaskKey,
} from "@/core/driver/progress/rules"

export default function DriverTaskModal({
  active_task,
}: Readonly<{
  active_task: DriverOnboardingTaskKey | null
}>) {
  const {
    get_item,
    request_close_modal,
    close_modal,
  } = use_driver_preparation()

  const item = active_task ? get_item(active_task) : null
  const title = active_task
    ? item?.label ?? DRIVER_PROGRESS_LABELS[active_task]
    : ""

  const handle_close = useCallback(() => {
    request_close_modal("user_close")
  }, [request_close_modal])

  const handle_cancel = useCallback(() => {
    request_close_modal("user_cancel")
  }, [request_close_modal])

  const handle_save_success = useCallback(() => {
    close_modal("save_completed")
  }, [close_modal])

  if (!active_task) {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="driver-task-modal-title"
    >
      <div className="flex max-h-[min(92dvh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_24px_64px_rgba(0,0,0,0.35)] sm:rounded-3xl">
        <header className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              稼働準備
            </p>
            <h2
              id="driver-task-modal-title"
              className="mt-1 text-lg font-bold leading-7 text-neutral-950"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={handle_close}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
          >
            <X aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {active_task === "driver_license" ? (
            <DriverLicenseTaskModalContent
              key="driver_license_front"
              initial_entry={item?.latest_entry ?? null}
              on_save_success={handle_save_success}
            />
          ) : (
            <DriverTaskPlaceholderModalContent task_key={active_task} />
          )}
        </div>

        <footer className="border-t border-neutral-200 px-5 py-4">
          <button
            type="button"
            onClick={handle_cancel}
            className="h-11 w-full rounded-full border border-neutral-300 text-sm font-semibold text-neutral-800"
          >
            {active_task === "driver_license" ? "キャンセル" : "閉じる"}
          </button>
        </footer>
      </div>
    </div>
  )
}
