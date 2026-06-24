"use client"

export default function DriverProgressErrorCard() {
  function handleReload() {
    window.location.reload()
  }

  return (
    <div className="mx-auto flex min-h-[240px] max-w-[430px] flex-col items-center justify-center rounded-3xl border border-neutral-200 bg-white px-6 py-10 text-center shadow-sm">
      <p className="text-[15px] font-medium leading-7 text-neutral-900">
        準備情報を読み込めませんでした。
      </p>
      <p className="mt-1 text-sm leading-6 text-neutral-600">
        再読み込みしてください。
      </p>
      <button
        type="button"
        onClick={handleReload}
        className="mt-6 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
      >
        再読み込み
      </button>
    </div>
  )
}
