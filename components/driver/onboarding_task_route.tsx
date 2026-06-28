"use client"

import { useParams, useRouter } from "next/navigation"

import DriverLicenseTaskPage from "@/components/driver/license_task_page"
import DriverTaskPlaceholderPage from "@/components/driver/task_placeholder_page"
import { use_driver_preparation } from "@/components/driver/preparation_provider"
import { is_onboarding_task_key } from "@/core/driver/progress/rules"

export default function DriverOnboardingTaskRoute() {
  const router = useRouter()
  const params = useParams<{ key: string }>()
  const { get_item } = use_driver_preparation()
  const key = params.key

  if (!is_onboarding_task_key(key)) {
    router.replace("/driver")
    return null
  }

  if (key === "driver_license") {
    const item = get_item("driver_license")

    return <DriverLicenseTaskPage initial_entry={item?.latest_entry ?? null} />
  }

  return <DriverTaskPlaceholderPage task_key={key} />
}
