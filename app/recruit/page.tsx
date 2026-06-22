import { DRIVER_RECRUITMENT_LIFF_URL } from "@/core/chat/rules"

export default function DriverRecruitmentPage() {
  return (
    <main className="min-h-screen bg-[#fdfaf6] px-6 py-12 text-[#3d2a19]">
      <section className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[#8f5d28]">
            PET TAXI DRIVER
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
            動物のためのドライバー募集
          </h1>
          <p className="text-base leading-8 text-[#6f5842]">
            ペットとご家族の移動を支えるドライバーを募集しています。
            LINEで連携後、「動物のためのドライバー」と送信してください。
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-[#ead7c3] bg-white p-5">
            <h2 className="text-base font-bold">安心運転</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f5842]">
              動物に配慮した丁寧な送迎を大切にします。
            </p>
          </div>
          <div className="rounded-md border border-[#ead7c3] bg-white p-5">
            <h2 className="text-base font-bold">柔軟な稼働</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f5842]">
              エリアや時間帯に合わせて参加できます。
            </p>
          </div>
          <div className="rounded-md border border-[#ead7c3] bg-white p-5">
            <h2 className="text-base font-bold">LINEで登録</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f5842]">
              公式LINEから登録フォームへ進めます。
            </p>
          </div>
        </div>

        <a
          href={DRIVER_RECRUITMENT_LIFF_URL}
          className="inline-flex h-12 w-fit items-center justify-center rounded-md bg-[#3d2a19] px-6 text-sm font-bold text-white"
        >
          登録フォームへ
        </a>
      </section>
    </main>
  )
}
