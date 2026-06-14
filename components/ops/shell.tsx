import OpsAssistant from "@/components/ops/assistant"

export default function OpsShell({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-5 px-5 pb-[calc(258px+env(safe-area-inset-bottom,0px))] pt-[calc(20px+env(safe-area-inset-top,0px))]">
        {children}
      </main>
      <OpsAssistant />
    </div>
  )
}
