import OpsComingSoon from "@/components/ops/coming-soon"
import OpsShell from "@/components/ops/shell"
import DriverOnboardingModal from "@/components/driver/onboarding_modal"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { load_driver_progress_state } from "@/core/driver/progress/action"
import {
  can_driver_operate,
  can_show_driver_onboarding,
} from "@/core/driver/progress/rules"
import { normalizeOpsHeaderSession } from "@/core/ops/header_session"
import { enforceAuthRouteRedirect } from "@/core/route/rules"

export default async function DriverPage() {
  await enforceAuthRouteRedirect("/driver")

  const context = await resolveAuthContext("/driver")
  const session = await resolveSession(context)
  const driver = await load_driver_progress_state(session.user_uuid)
  const onboarding_locked = can_show_driver_onboarding({
    role: session.role,
    status: driver.status,
  })
  const can_operate = can_driver_operate(driver.status)

  return (
    <OpsShell
      pathname="/driver"
      session={normalizeOpsHeaderSession(session, {
        default_display_name: "Driver",
        default_role: "driver",
      })}
      show_assistant={can_operate}
      interaction_locked={onboarding_locked}
    >
      {onboarding_locked ? (
        <DriverOnboardingModal
          initial_items={driver.items}
          initial_status={driver.status}
          completed_count={driver.completed_count}
          total_count={driver.total_count}
        />
      ) : null}

      {can_operate ? <OpsComingSoon title="Driver" /> : null}
    </OpsShell>
  )
}
