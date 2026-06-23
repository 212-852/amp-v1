"use client"

import Link from "next/link"

export default function EntrySuccessScreen() {
  return (
    <section className="grid gap-6 rounded-[20px] bg-[#fffaf3] px-5 py-8 text-center ring-1 ring-[#d7b98f]">
      <div className="space-y-4">
        <h2 className="text-xl font-bold leading-relaxed text-[#3d2a19]">
          応募ありがとうございます。
        </h2>
        <p className="text-[15px] leading-8 text-[#6f5842]">
          内容を確認後、
          <br />
          担当者よりご連絡いたします。
        </p>
        <p className="text-[14px] leading-7 text-[#8c7358]">
          LINEチャットからいつでもご質問ください。
        </p>
      </div>

      <Link
        href="/app"
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#06C755] px-8 text-sm font-bold text-white shadow-[0_8px_18px_rgba(6,199,85,0.24)]"
      >
        チャットへ戻る
      </Link>
    </section>
  )
}
