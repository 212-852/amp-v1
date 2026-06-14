import OpsNeko from "@/components/ops/neko"

export default function OpsAssistant() {
  return (
    <section
      aria-label="AI assistant"
      className="fixed inset-x-0 bottom-0 z-50 bg-neutral-50 px-5 pb-[calc(6px+env(safe-area-inset-bottom,0px))]"
    >
      <div className="relative mx-auto w-full max-w-[430px]">
        <div className="relative overflow-visible rounded-[28px] border border-neutral-200 bg-white px-4 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2">
            <div className="relative h-[92px] w-[84px] shrink-0">
              <div className="pointer-events-none absolute bottom-0 left-0 origin-bottom-left translate-y-[16%]">
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

              <div className="mt-3 space-y-0.5">
                <p className="text-[11px] font-semibold leading-snug text-neutral-950">
                  お知らせがあります
                </p>
                <p className="text-[11px] font-medium leading-snug text-neutral-500">
                  今日の予定
                </p>
                <p className="pt-1 text-[14px] font-semibold leading-snug tracking-[-0.02em] text-neutral-950">
                  14:30 出発確認
                </p>
              </div>
            </div>

            <button
              type="button"
              className="shrink-0 self-center rounded-full bg-neutral-950 px-4 py-2.5 text-[12px] font-semibold text-white"
            >
              呼び出す
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
