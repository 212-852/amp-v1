import OpsComingSoon from "@/components/ops/coming-soon"
import OpsShell from "@/components/ops/shell"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { normalizeOpsHeaderSession } from "@/core/ops/header_session"

export default async function DriverPage() {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)

  return (
    <OpsShell
      pathname={context.requested_route ?? "/driver"}
      session={normalizeOpsHeaderSession(session, {
        default_display_name: "Driver",
        default_role: "driver",
      })}
    >
      <OpsComingSoon title="Driver" />
    </OpsShell>
  )
}
