"use client"

export default function LineAuthLoopBlocked() {
  function handleReload() {
    window.location.reload()
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f5e8d5] p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white px-6 py-8 text-center shadow-sm">
        <p className="text-[15px] font-medium leading-7 text-neutral-900">
          ログイン状態を確認しています。再読み込みしてください。
        </p>
        <button
          type="button"
          onClick={handleReload}
          className="mt-6 rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
        >
          再読み込み
        </button>
      </div>
    </main>
  )
}
