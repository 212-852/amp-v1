import OpsAssistant from "@/components/ops/assistant"
import OpsHeader from "@/components/ops/header"

export default function OpsShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <OpsHeader />
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(218px+env(safe-area-inset-bottom,0px))] pt-4">
        {children}
      </main>
      <OpsAssistant />
    </div>
  )
}
