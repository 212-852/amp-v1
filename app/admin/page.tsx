import AdminAssistant from "@/components/admin/assistant"
import AdminCard from "@/components/admin/card"
import AdminHeader from "@/components/admin/header"
import AdminNav from "@/components/admin/nav"
import AdminProfile from "@/components/admin/profile"

const today_stats = [
  { label: "予約", value: "18件" },
  { label: "対応待ち", value: "3件" },
  { label: "コンシェルジュ", value: "2件" },
]

const action_items = [
  {
    time: "14:30",
    title: "羽田迎え",
    detail: "ドライバー未割当",
  },
  {
    time: "15:20",
    title: "LINE問い合わせ",
    detail: "Coming Soon",
  },
  {
    time: "16:00",
    title: "決済確認",
    detail: "Coming Soon",
  },
]

function ActionRow({
  time,
  title,
  detail,
}: Readonly<{
  time: string
  title: string
  detail: string
}>) {
  return (
    <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-5 py-4">
      <p className="text-[12px] font-medium text-neutral-500">{time}</p>
      <p className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-neutral-950">
        {title}
      </p>
      <p className="mt-1 text-[13px] leading-5 text-neutral-500">{detail}</p>
    </div>
  )
}

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-950">
      <div className="mx-auto w-full max-w-[430px] pb-[calc(200px+72px+env(safe-area-inset-bottom,0px))]">
        <AdminHeader />
        <AdminProfile />

        <main className="mt-8 space-y-6 px-5">
          <AdminCard title="本日の状況">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-[12px] font-semibold text-neutral-700">
                稼働中
              </div>

              <div className="space-y-4">
                {today_stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-4 last:border-b-0 last:pb-0"
                  >
                    <p className="text-[14px] font-medium text-neutral-500">
                      {stat.label}
                    </p>
                    <p className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </AdminCard>

          <AdminCard title="対応が必要">
            <div className="space-y-3">
              {action_items.map((item) => (
                <ActionRow
                  key={`${item.time}-${item.title}`}
                  time={item.time}
                  title={item.title}
                  detail={item.detail}
                />
              ))}
            </div>
          </AdminCard>
        </main>
      </div>

      <AdminAssistant />
      <AdminNav />
    </div>
  )
}
