import { redirect } from "next/navigation"

import AppFooter from "@/components/app/footer"
import AppHeader from "@/components/app/header"
import { resolveAmpRoute } from "@/core/route/rules"

const quickMenuItems = [
  "空き状況を確認",
  "予約する",
  "予約を確認する",
  "待ち合わせ場所を共有",
  "予約をキャンセル",
]

export default async function Page() {
  const route = await resolveAmpRoute()

  if (route.path !== "/") {
    redirect(route.path)
  }

  return (
    <div className="min-h-dvh bg-[#f1ddbf] text-[#3d2a19]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[390px] px-4 pb-[calc(188px+env(safe-area-inset-bottom,0px))] pt-[118px]">
        <section className="rounded-[30px] bg-[#fffaf2] p-5 shadow-[0_12px_28px_rgba(107,74,38,0.13)]">
          <div className="rounded-[24px] bg-white px-4 py-5 shadow-[inset_0_0_0_1px_rgba(122,78,34,0.08)]">
            <p className="text-[12px] font-black tracking-[0.08em] text-[#9b7951]">
              Quick Menu
            </p>
            <div className="mt-4 grid gap-3">
              {quickMenuItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="h-[58px] rounded-[22px] bg-[#7a4e22] px-5 text-left text-[15px] font-black text-white shadow-[0_7px_14px_rgba(122,78,34,0.22)]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-[24px] bg-[#f8ead6] px-4 py-4">
            <p className="text-[13px] font-black text-[#6a431f]">
              サポート
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[#8b6a45]">
              予約や待ち合わせ場所について、必要なときにサポートを確認できます。
            </p>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  )
}
