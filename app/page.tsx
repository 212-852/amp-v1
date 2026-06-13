import { redirect } from "next/navigation"

import AppFooter from "@/components/app/footer"
import AppHeader from "@/components/app/header"
import { resolveAmpRoute } from "@/core/route/rules"

const quickMenuItems = [
  "Reserve a ride",
  "Airport transfer",
  "Check reservation",
  "My pickup point",
]

export default async function Page() {
  const route = await resolveAmpRoute()

  if (route.path !== "/") {
    redirect(route.path)
  }

  return (
    <div className="min-h-dvh bg-[#f3dfc2] text-[#3f2d1d]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[390px] px-4 pb-[212px] pt-[138px]">
        <section className="rounded-[30px] bg-[#fffaf2] p-5 shadow-[0_10px_30px_rgba(107,74,38,0.12)]">
          <div className="rounded-[24px] bg-white px-4 py-5 shadow-[inset_0_0_0_1px_rgba(122,78,34,0.08)]">
            <p className="text-[12px] font-black uppercase tracking-[0.12em] text-[#9b7951]">
              Quick Menu
            </p>
            <h2 className="mt-2 text-[24px] font-black leading-tight text-[#3f2d1d]">
              Where would you like to go?
            </h2>
            <div className="mt-5 grid gap-3">
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
              Pickup support
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[#8b6a45]">
              Share your pickup details when you are ready.
            </p>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  )
}
