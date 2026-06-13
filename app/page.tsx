import AppFooter from "@/components/app/footer"
import AppHeader from "@/components/app/header"

const quick_menu_items = [
  "Check availability",
  "Request a ride",
  "Review reservation",
  "Share meetup location",
  "Cancel reservation",
]

export default function Page() {
  return (
    <div className="min-h-dvh bg-[#f6e5cf] text-[#3d2f24]">
      <AppHeader />

      <main className="mx-auto w-full max-w-[430px] px-4 pb-[calc(168px+env(safe-area-inset-bottom,0px))] pt-24">
        <section className="rounded-[28px] border border-[#eadccc] bg-white p-5">
          <h2 className="text-base font-bold text-[#3d2f24]">Quick Menu</h2>
          <p className="mt-1 text-sm text-[#8a7359]">
            Choose an action to continue.
          </p>

          <div className="mt-4 grid gap-3">
            {quick_menu_items.map((label) => (
              <button
                key={label}
                type="button"
                className="h-12 w-full rounded-[20px] bg-[#8b6f47] text-sm font-bold text-white"
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-[#eadccc] bg-white p-5">
          <h2 className="text-base font-bold text-[#3d2f24]">Meetup support</h2>
          <p className="mt-2 text-sm leading-6 text-[#8a7359]">
            Share your meetup location and keep your driver updated during
            pickup. This section is a UI placeholder only.
          </p>
          <div className="mt-4 rounded-[20px] border border-dashed border-[#dcc9ae] bg-[#fff8ef] px-4 py-6 text-center text-sm text-[#9a8468]">
            Meetup location card area
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  )
}
