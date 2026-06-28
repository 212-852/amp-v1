"use client"

import { memo } from "react"
import { CheckCircle2, ChevronRight, Clock3, XCircle } from "lucide-react"

import type {
  DriverChecklistItem,
  DriverOnboardingTaskStatus,
} from "@/core/driver/context"

function TaskStatusIcon({
  status,
}: Readonly<{ status: DriverOnboardingTaskStatus }>) {
  if (status === "complete") {
    return (
      <CheckCircle2
        aria-hidden="true"
        className="h-6 w-6 shrink-0 text-emerald-600"
        strokeWidth={2.25}
      />
    )
  }

  if (status === "in_progress") {
    return (
      <Clock3
        aria-hidden="true"
        className="h-6 w-6 shrink-0 text-amber-500"
        strokeWidth={2.25}
      />
    )
  }

  return (
    <XCircle
      aria-hidden="true"
      className="h-6 w-6 shrink-0 text-red-500"
      strokeWidth={2.25}
    />
  )
}

function OnboardingTaskCard({
  item,
  on_open,
}: Readonly<{
  item: DriverChecklistItem
  on_open: () => void
}>) {
  return (
    <button
      type="button"
      onClick={on_open}
      className="group flex w-full items-center gap-4 rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-left shadow-sm transition hover:border-neutral-300 hover:shadow-md"
    >
      <TaskStatusIcon status={item.task_status} />

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold leading-6 text-neutral-950">
          {item.label}
        </p>
        <p className="mt-0.5 text-sm leading-5 text-neutral-500">
          {item.description}
        </p>
      </div>

      <ChevronRight
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-neutral-400 transition group-hover:text-neutral-600"
        strokeWidth={2.25}
      />
    </button>
  )
}

export default memo(OnboardingTaskCard)
