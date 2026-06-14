import RoboNekoCharacter from "@/components/admin/neko"

export default function AdminAssistant() {
  return (
    <section
      aria-label="roboNeko assistant"
      className="fixed inset-x-0 bottom-0 z-50 bg-neutral-50 px-5 pb-[calc(14px+env(safe-area-inset-bottom,0px))]"
    >
      <div className="relative mx-auto min-h-[190px] w-full max-w-[430px] rounded-[32px] border border-neutral-200 bg-white px-5 py-5 shadow-[0_-8px_28px_rgba(0,0,0,0.06)]">
        <div className="absolute bottom-4 left-5">
          <RoboNekoCharacter />
        </div>

        <div className="grid min-h-[150px] grid-cols-[96px_1fr_auto] items-end gap-3">
          <div />
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
    </section>
  )
}
