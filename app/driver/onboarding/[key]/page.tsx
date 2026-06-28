import { redirect } from "next/navigation"

import DriverLicenseTaskPage from "@/components/driver/license_task_page"
import DriverTaskPlaceholderPage from "@/components/driver/task_placeholder_page"
import OpsShell from "@/components/ops/shell"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import {
  build_onboarding_task_items,
  can_show_driver_onboarding,
  is_onboarding_task_key,
} from "@/core/driver/progress/rules"
import { resolve_driver_page_state } from "@/core/driver/progress/output"
import { normalizeOpsHeaderSession } from "@/core/ops/header_session"
import { enforceAuthRouteRedirect } from "@/core/route/rules"

export const dynamic = "force-dynamic"

export default async function DriverOnboardingTaskPage({
  params,
}: Readonly<{
  params: Promise<{ key: string }>
}>) {
  await enforceAuthRouteRedirect("/driver")

  const { key } = await params

  if (!is_onboarding_task_key(key)) {
    redirect("/driver")
  }

  const context = await resolveAuthContext("/driver")
  const session = await resolveSession(context)
  const progress_result = await resolve_driver_page_state(session.user_uuid)

  if (!progress_result.ok) {
    redirect("/driver")
  }

  const driver = progress_result.state
  const onboarding_locked = can_show_driver_onboarding({
    role: session.role,
    status: driver.status,
  })

  if (!onboarding_locked) {
    redirect("/driver")
  }

  const items = build_onboarding_task_items(driver.progress, {
    legacy_has_driver_license: driver.legacy_has_driver_license,
  })
  const item = items.find((entry) => entry.key === key) ?? null

  return (
    <OpsShell
      pathname="/driver"
      session={normalizeOpsHeaderSession(session, {
        default_display_name: "Driver",
        default_role: "driver",
      })}
      show_assistant={false}
      interaction_locked
    >
      {key === "driver_license" ? (
        <DriverLicenseTaskPage initial_entry={item?.latest_entry ?? null} />
      ) : (
        <DriverTaskPlaceholderPage task_key={key} />
      )}
    </OpsShell>
  )
}
