import OpsComingSoon from "@/components/ops/coming-soon"
import OpsShell from "@/components/ops/shell"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { normalizeOpsHeaderSession } from "@/core/ops/header_session"
import { enforceAuthRouteRedirect } from "@/core/route/rules"

export default async function DriverPage() {
  await enforceAuthRouteRedirect("/driver")

  const context = await resolveAuthContext("/driver")
  const session = await resolveSession(context)

  return (
    <OpsShell
      pathname="/driver"
      session={normalizeOpsHeaderSession(session, {
        default_display_name: "Driver",
        default_role: "driver",
      })}
    >
      <OpsComingSoon title="Driver" />
    </OpsShell>
  )
}
