import AppFooter from "@/components/app/footer"
import AppHeader from "@/components/app/header"
import AppHome from "@/components/app/home"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { resolveChatSupportAccess } from "@/core/chat/support"
import { resolveOutputLocaleDecision } from "@/core/chat/context"
import { sendAuthDebug } from "@/core/debug"
import { enforceAuthRouteRedirect } from "@/core/route/rules"

export default async function AppPage() {
  await enforceAuthRouteRedirect("/app")

  const context = await resolveAuthContext("/app")
  const session = await resolveSession(context)

  const support_access = resolveChatSupportAccess({
    user_uuid: session.user_uuid,
    role: session.role,
    tier: session.tier,
  })

  const locale_decision = resolveOutputLocaleDecision({
    preferred: context.locale,
  })

  await sendAuthDebug("app_locale_resolved", {
    final_locale: locale_decision.final_locale,
    source: context.locale ? "request_context" : locale_decision.source,
    user_locale: null,
    session_locale: context.locale ?? null,
    cookie_locale: null,
    room_locale: null,
    browser_locale: null,
  })

  return (
    <div
      className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-[#f5e8d5] text-[#3d2a19] pt-[calc(108px+env(safe-area-inset-top,0px))] [--chat-composer-height:186px] [--chat-input-height:186px] [--chat-message-bottom-padding:calc(var(--chat-composer-height)+env(safe-area-inset-bottom,0px)+48px)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <AppHeader auth={session} />
      <AppHome
        chat_state={null}
        viewer_display_name={session.display_name}
      />
      <AppFooter
        support_access={support_access}
        can_start_line_oauth={session.can_start_line_oauth}
        initial_mode="bot"
      />
    </div>
  )
}
