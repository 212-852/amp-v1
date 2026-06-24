"use client"

import { CheckCircle2, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import DriverLicenseStep from "@/components/driver/license_step"
import type { DriverChecklistItem, DriverStatus } from "@/core/driver/context"

function ProgressStatusIcon({ complete }: Readonly<{ complete: boolean }>) {
  if (complete) {
    return (
      <CheckCircle2
        aria-hidden="true"
        className="h-5 w-5 shrink-0 text-emerald-600"
        strokeWidth={2.25}
      />
    )
  }

  return (
    <XCircle
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-red-600"
      strokeWidth={2.25}
    />
  )
}

export default function DriverOnboardingModal({
  initial_items,
  initial_status,
  completed_count,
  total_count,
}: Readonly<{
  initial_items: DriverChecklistItem[]
  initial_status: DriverStatus
  completed_count: number
  total_count: number
}>) {
  const router = useRouter()
  const [licenseStepOpen, setLicenseStepOpen] = useState(false)

  if (initial_status !== "provisional") {
    return null
  }

  function handleLicenseComplete() {
    setLicenseStepOpen(false)
    router.refresh()
  }

  return (
    <>
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
            {(initial_items ?? []).map((item) => (
              <li key={item.key}>
                {item.key === "driver_license" ? (
                  <button
                    type="button"
                    onClick={() => setLicenseStepOpen(true)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-left transition hover:bg-neutral-50"
                  >
                    <ProgressStatusIcon complete={item.complete} />
                    <span className="text-[15px] font-medium leading-6 text-neutral-900">
                      {item.label}
                    </span>
                  </button>
                ) : (
                  <div className="flex w-full items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3">
                    <ProgressStatusIcon complete={item.complete} />
                    <span className="text-[15px] font-medium leading-6 text-neutral-900">
                      {item.label}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {licenseStepOpen ? (
        <DriverLicenseStep
          onClose={() => setLicenseStepOpen(false)}
          onComplete={handleLicenseComplete}
        />
      ) : null}
    </>
  )
}
