import OpsNeko from "@/components/ops/neko"

type AssistantNotification = {
  label: string
  message: string
}

const notifications: AssistantNotification[] = [
  { label: "予約", message: "14:30 羽田迎え" },
  { label: "運営", message: "未読1件" },
  { label: "配車", message: "対応待ち2件" },
]

export default function OpsAssistant() {
  const visible_notifications = notifications.filter(
    (item) => item.message && !item.message.includes("通知なし"),
  )

  return (
    <section
      aria-label="AI assistant"
      className="fixed inset-x-0 bottom-0 z-50 bg-neutral-50 px-5 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative mx-auto w-full max-w-[430px]">
        <div className="relative overflow-visible rounded-[24px] border border-neutral-200 bg-white px-3 py-2.5 shadow-[0_-6px_20px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2.5">
            <div className="relative h-[84px] w-[68px] shrink-0">
              <div className="pointer-events-none absolute bottom-[-8px] left-0">
                <div className="h-[72px] w-[68px] overflow-hidden">
                  <OpsNeko className="h-[92px] w-[68px] object-contain object-top" />
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="whitespace-nowrap text-[15px] font-semibold leading-none tracking-[-0.02em] text-neutral-950">
                AIアシスタント
              </p>

              <div className="mt-2 space-y-1">
                {visible_notifications.map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-[40px_1fr] items-baseline gap-2 text-[11px] leading-tight"
                  >
                    <p className="font-semibold text-neutral-950">{item.label}</p>
                    <p className="truncate font-medium text-neutral-500">
                      {item.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
