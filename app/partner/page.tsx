import { DRIVER_PARTNER_LIFF_URL } from "@/core/chat/rules"

export default function PartnerDriverPage() {
  return (
    <main className="min-h-screen bg-[#fdfaf6] px-6 py-12 text-[#3d2a19]">
      <section className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[#8f5d28]">
            PARTNER DRIVER
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
            Partner Driver Program
          </h1>
          <p className="text-base leading-8 text-[#6f5842]">
            ペットとご家族の移動をサポートする
            <br />
            パートナードライバー募集
          </p>
        </div>

        <a
          href={DRIVER_PARTNER_LIFF_URL}
          className="inline-flex h-12 w-fit items-center justify-center rounded-md bg-[#06c755] px-6 text-sm font-bold text-white"
        >
          Join via LINE
        </a>
      </section>
    </main>
  )
}
