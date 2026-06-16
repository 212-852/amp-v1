import OpsAssistant from "@/components/ops/assistant"
import OpsHeader from "@/components/ops/header"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"

export default async function OpsShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const context = await resolveAuthContext()
  const session = await resolveSession(context)

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <OpsHeader session={session} />
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(118px+env(safe-area-inset-bottom,0px))] pt-4">
        {children}
      </main>
      <OpsAssistant />
    </div>
  )
}
