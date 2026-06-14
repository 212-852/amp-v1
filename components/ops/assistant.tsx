import OpsNeko from "@/components/ops/neko"

export default function OpsAssistant() {
  return (
    <section
      aria-label="AI assistant"
      className="fixed inset-x-0 bottom-0 z-50 bg-neutral-50 px-5 pb-[env(safe-area-inset-bottom)] pt-1"
    >
      <div className="relative mx-auto w-full max-w-[430px]">
        <div className="relative min-h-[178px] overflow-visible rounded-[32px] border border-neutral-200 bg-white px-5 py-5 shadow-[0_-10px_30px_rgba(0,0,0,0.06)]">
          <div className="grid min-h-[138px] grid-cols-[108px_1fr_auto] items-end gap-3">
            <div aria-hidden="true" />
            <div className="min-w-0 pb-1">
              <p className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">
                AIアシスタント
              </p>
              <p className="mt-1 text-[12px] font-medium text-neutral-500">
                運行・連絡・確認
              </p>

              <div className="mt-5 space-y-1">
                <p className="text-[12px] font-semibold text-neutral-950">
                  お知らせがあります
                </p>
                <p className="text-[12px] font-medium text-neutral-500">
                  今日の予定
                </p>
                <p className="pt-2 text-[15px] font-semibold tracking-[-0.02em] text-neutral-950">
                  14:30 出発確認
                </p>
              </div>
            </div>

            <button
              type="button"
              className="mb-1 rounded-full bg-neutral-950 px-5 py-3 text-[13px] font-semibold text-white"
            >
              呼び出す
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 origin-bottom-left translate-y-[26%] scale-[1]">
          <OpsNeko />
        </div>
      </div>
    </section>
  )
}
