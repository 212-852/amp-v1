import AppFooter from "@/components/app/footer"
import AppHeader from "@/components/app/header"
import AppHome from "@/components/app/home"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { resolveChatSupportAccess } from "@/core/chat/support"
import { resolveChatRoom } from "@/core/chat/action"

export default async function AppPage() {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)

  const support_access = resolveChatSupportAccess({
    user_uuid: session.user_uuid,
    role: session.role,
    tier: session.tier,
  })

  let chat_state = null

  try {
    chat_state = await resolveChatRoom(session, {
      source_channel: context.source_channel,
      locale: context.locale,
    })
  } catch {
    chat_state = null
  }

  return (
    <div
      className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-[#f5e8d5] text-[#3d2a19] pt-[calc(108px+env(safe-area-inset-top,0px))] [--chat-input-height:186px]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <AppHeader auth={session} />
      <AppHome
        chat_state={chat_state}
        viewer_display_name={session.display_name}
      />
      <AppFooter
        support_access={support_access}
        can_start_line_oauth={session.can_start_line_oauth}
        initial_mode={
          chat_state?.room.mode === "concierge" ? "concierge" : "bot"
        }
      />
    </div>
  )
}
