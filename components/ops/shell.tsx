import OpsAssistant from "@/components/ops/assistant"
import OpsHeader from "@/components/ops/header"
import { resolvePageLabel } from "@/core/ops/page_label"
import type { OpsHeaderSession } from "@/core/ops/header_session"

export default function OpsShell({
  children,
  session,
  pathname,
}: Readonly<{
  children: React.ReactNode
  session: OpsHeaderSession
  pathname: string
}>) {
  const page_label = resolvePageLabel(pathname)

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <OpsHeader session={session} page_label={page_label} />
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(118px+env(safe-area-inset-bottom,0px))] pt-4">
        {children}
      </main>
      <OpsAssistant />
    </div>
  )
}
