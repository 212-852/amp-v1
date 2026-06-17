import OpsNeko from "@/components/ops/neko"

type FooterNotification = {
  label: string
  message: string
}

const notifications: FooterNotification[] = [
  { label: "予約", message: "14:30 羽田迎え" },
  { label: "運営", message: "未読1件" },
  { label: "配車", message: "対応待ち2件" },
]

export default function AdminFooter() {
  return (
    <section
      aria-label="Admin assistant footer"
      className="fixed inset-x-0 bottom-0 z-50 px-5 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative mx-auto w-full max-w-[430px]">
        <div className="rounded-t-[24px] rounded-b-[4px] border border-b-0 border-neutral-200 bg-white px-2.5 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-2">
            <OpsNeko className="footer" />

            <div className="min-w-0 flex-1 space-y-0.5 py-0.5">
              {notifications.map((item) => (
                <div
                  key={item.label}
                  className="grid grid-cols-[36px_1fr] items-baseline gap-2 text-[11px] leading-tight"
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
    </section>
  )
}
