import DriverProgressErrorCard from "@/components/driver/progress_error"
import { DriverPreparationProvider } from "@/components/driver/preparation_provider"
import OpsShell from "@/components/ops/shell"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import {
  build_driver_page_error_output,
  resolve_driver_page_state,
} from "@/core/driver/progress/output"
import {
  can_driver_operate,
  can_show_driver_onboarding,
} from "@/core/driver/progress/rules"
import { normalizeOpsHeaderSession } from "@/core/ops/header_session"
import { enforceAuthRouteRedirect } from "@/core/route/rules"

export const dynamic = "force-dynamic"

function renderDriverProgressError(
  session: Awaited<ReturnType<typeof resolveSession>>,
) {
  return (
    <OpsShell
      pathname="/driver"
      session={normalizeOpsHeaderSession(session, {
        default_display_name: "Driver",
        default_role: "driver",
      })}
      show_assistant={false}
      interaction_locked={false}
    >
      <DriverProgressErrorCard />
    </OpsShell>
  )
}

export default async function DriverLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  try {
    await enforceAuthRouteRedirect("/driver")

    const context = await resolveAuthContext("/driver")
    const session = await resolveSession(context)
    const progress_result = await resolve_driver_page_state(session.user_uuid)

    if (!progress_result.ok) {
      build_driver_page_error_output({
        error_message: progress_result.error_message,
        user_uuid: session.user_uuid,
        driver_uuid: progress_result.driver_uuid,
        has_driver: progress_result.has_driver,
        has_driver_progress: progress_result.has_driver_progress,
      })

      return renderDriverProgressError(session)
    }

    const driver = progress_result.state
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
          <DriverPreparationProvider
            initial_items={driver.items ?? []}
            initial_all_complete={driver.all_complete}
            can_operate={can_operate}
          >
            {children}
          </DriverPreparationProvider>
        ) : (
          children
        )}
      </OpsShell>
    )
  } catch (error) {
    const error_message =
      error instanceof Error ? error.message : "Driver layout render failed"

    if (error_message.includes("Dynamic server usage")) {
      throw error
    }

    build_driver_page_error_output({
      error_message,
      user_uuid: null,
      driver_uuid: null,
      has_driver: false,
      has_driver_progress: false,
    })

    const context = await resolveAuthContext("/driver").catch(() => null)
    const session = context ? await resolveSession(context).catch(() => null) : null

    if (session) {
      return renderDriverProgressError(session)
    }

    return (
      <main className="flex min-h-dvh items-center justify-center bg-neutral-50 p-6">
        <DriverProgressErrorCard />
      </main>
    )
  }
}
