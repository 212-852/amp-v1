"use client"

import DriverOnboardingChecklist from "@/components/driver/onboarding_checklist"
import { useDriverPreparationOptional } from "@/components/driver/preparation_provider"
import OpsComingSoon from "@/components/ops/coming-soon"

export default function DriverPreparationHome() {
  const preparation = useDriverPreparationOptional()

  if (!preparation || preparation.can_operate) {
    return <OpsComingSoon title="Driver" />
  }

  return <DriverOnboardingChecklist />
}
