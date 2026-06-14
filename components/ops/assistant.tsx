import OpsNeko from "@/components/ops/neko"

const notifications = [
  { label: "予約", message: "14:30 羽田迎え確認" },
  { label: "ドライバー", message: "佐藤 未読1件" },
  { label: "コンシェルジュ", message: "引継ぎ待ち 2件" },
  { label: "システム", message: "通知なし" },
]

export default function OpsAssistant() {
  return (
    <section
      aria-label="AI assistant"
      className="fixed inset-x-0 bottom-0 z-50 bg-neutral-50 px-5 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative mx-auto w-full max-w-[430px]">
        <div className="relative overflow-visible rounded-[28px] border border-neutral-200 bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-end gap-3">
            <div className="relative h-[138px] w-[96px] shrink-0 overflow-hidden">
              <div className="pointer-events-none absolute bottom-[-22px] left-[-8px] origin-bottom-left scale-[1.02]">
                <OpsNeko />
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="whitespace-nowrap text-[17px] font-semibold leading-tight tracking-[-0.02em] text-neutral-950">
                AIアシスタント
              </p>
              <p className="mt-0.5 text-[11px] font-medium leading-snug text-neutral-500">
                運行・連絡・確認
              </p>

              <div className="mt-3 border-t border-neutral-100 pt-3">
                <div className="space-y-1.5">
                  {notifications.map((item) => (
                    <div
                      key={item.label}
                      className="grid grid-cols-[76px_1fr] gap-2 text-[11px] leading-snug"
                    >
                      <p className="font-semibold text-neutral-950">
                        {item.label}
                      </p>
                      <p className="font-medium text-neutral-500">
                        ・{item.message}
                      </p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="mt-3 text-[12px] font-semibold text-neutral-950"
                >
                  詳細を見る &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
