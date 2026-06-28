"use client"

import OnboardingTaskShell from "@/components/driver/onboarding_task_shell"
import {
  DRIVER_ONBOARDING_TASK_DESCRIPTIONS,
  DRIVER_PROGRESS_LABELS,
  type DriverOnboardingTaskKey,
} from "@/core/driver/progress/rules"

export default function DriverTaskPlaceholderPage({
  task_key,
}: Readonly<{
  task_key: DriverOnboardingTaskKey
}>) {
  const title = DRIVER_PROGRESS_LABELS[task_key]
  const description = DRIVER_ONBOARDING_TASK_DESCRIPTIONS[task_key]

  return (
    <OnboardingTaskShell title={title}>
      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-sm leading-6 text-neutral-600">{description}</p>
        <p className="text-sm leading-6 text-neutral-600">
          この項目の登録画面は準備中です。しばらくしてから再度お試しください。
        </p>
      </div>
    </OnboardingTaskShell>
  )
}
