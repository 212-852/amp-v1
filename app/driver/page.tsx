import OpsComingSoon from "@/components/ops/coming-soon"
import OpsShell from "@/components/ops/shell"
import DriverPreparationChecklist from "@/components/driver/preparation_checklist"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { load_driver_state } from "@/core/driver/action"
import {
  can_driver_operate,
  can_show_driver_preparation,
} from "@/core/driver/rules"
import { normalizeOpsHeaderSession } from "@/core/ops/header_session"
import { enforceAuthRouteRedirect } from "@/core/route/rules"

export default async function DriverPage() {
  await enforceAuthRouteRedirect("/driver")

  const context = await resolveAuthContext("/driver")
  const session = await resolveSession(context)
  const driver = await load_driver_state(session.user_uuid)
  const show_preparation = can_show_driver_preparation({
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
    >
      {show_preparation ? (
        <DriverPreparationChecklist
          initial_items={driver.items}
          initial_all_ready={driver.all_ready}
          initial_status={driver.status}
        />
      ) : null}

      {can_operate ? (
        <OpsComingSoon title="Driver" />
      ) : (
        <section className="rounded-2xl bg-white px-4 py-5 text-sm leading-7 text-neutral-600 ring-1 ring-neutral-200">
          仮登録済みです。必須の準備が完了するまで稼働できません。
        </section>
      )}
    </OpsShell>
  )
}
