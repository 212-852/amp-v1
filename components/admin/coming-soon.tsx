export default function AdminComingSoon({
  title,
}: Readonly<{
  title: string
}>) {
  return (
    <>
      <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
          {title}
        </h2>
        <div className="mt-6 space-y-5">
          <p className="text-[24px] font-semibold tracking-[-0.04em] text-neutral-950">
            確認中
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <p className="text-[14px] font-medium text-neutral-500">次</p>
              <p className="text-[16px] font-semibold text-neutral-950">--</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-medium text-neutral-500">
                対応待ち
              </p>
              <p className="text-[16px] font-semibold text-neutral-950">
                --件
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
          今日の予定
        </h2>
        <div className="mt-6 space-y-4">
          {["--:-- 未設定", "--:-- 未設定"].map((item) => (
            <div
              key={item}
              className="rounded-[22px] border border-neutral-200 bg-neutral-50 px-5 py-4 text-[15px] font-semibold text-neutral-950"
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="rounded-full bg-neutral-950 px-5 py-4 text-[14px] font-semibold text-white"
        >
          確認する
        </button>
        <button
          type="button"
          className="rounded-full border border-neutral-300 bg-white px-5 py-4 text-[14px] font-semibold text-neutral-950"
        >
          切り替え
        </button>
      </div>
    </>
  )
}
