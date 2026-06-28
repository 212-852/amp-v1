"use client"

import DriverOnboardingChecklist from "@/components/driver/onboarding_checklist"
import { use_driver_preparation_optional } from "@/components/driver/preparation_provider"
import OpsComingSoon from "@/components/ops/coming-soon"

export default function DriverPreparationHome() {
  const preparation = use_driver_preparation_optional()

  if (!preparation || preparation.can_operate) {
    return <OpsComingSoon title="Driver" />
  }

  return <DriverOnboardingChecklist />
}
