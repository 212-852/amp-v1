"use client"

import {
  DRIVER_ONBOARDING_TASK_DESCRIPTIONS,
  DRIVER_PROGRESS_LABELS,
  type DriverOnboardingTaskKey,
} from "@/core/driver/progress/rules"

export default function DriverTaskPlaceholderModalContent({
  task_key,
}: Readonly<{
  task_key: DriverOnboardingTaskKey
}>) {
  const title = DRIVER_PROGRESS_LABELS[task_key]
  const description = DRIVER_ONBOARDING_TASK_DESCRIPTIONS[task_key]

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
      <p className="text-sm leading-6 text-neutral-600">{description}</p>
      <p className="text-sm leading-6 text-neutral-600">
        {title}の登録画面は準備中です。しばらくしてから再度お試しください。
      </p>
    </div>
  )
}
