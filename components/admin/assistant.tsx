import RoboNekoCharacter from "@/components/admin/neko"

export default function AdminAssistant() {
  return (
    <section
      aria-label="roboNeko assistant"
      className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 border-t border-neutral-200 bg-white"
    >
      <div className="relative mx-auto h-[200px] w-full max-w-[430px] px-5 py-4">
        <div className="flex h-full items-end justify-between gap-4">
          <div className="absolute bottom-2 left-5">
            <RoboNekoCharacter />
          </div>

          <div className="ml-auto flex min-w-0 flex-1 flex-col items-end justify-between py-1 pl-[96px]">
            <div className="w-full text-right">
              <p className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">
                roboNeko
              </p>
              <p className="mt-2 text-[12px] leading-5 text-neutral-500">
                運行・配車・顧客対応・管理
              </p>
            </div>

            <button
              type="button"
              className="mt-4 rounded-full border border-neutral-300 bg-white px-6 py-3 text-[13px] font-semibold text-neutral-900 shadow-[0_4px_14px_rgba(0,0,0,0.04)]"
            >
              呼び出す
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
