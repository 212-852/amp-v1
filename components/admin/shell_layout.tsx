import OpsAssistant from "@/components/ops/assistant"
import AdminBreadcrumb from "@/components/admin/breadcrumb"
import { build_breadcrumb_output } from "@/core/breadcrumb/output"

const placeholder_cards = [
  { title: "本日の状況", body: "Placeholder card" },
  { title: "注文", body: "Coming soon" },
  { title: "ドライバー", body: "Coming soon" },
]

export default function AdminShellLayout({
  header,
  children,
  pathname = "/admin",
}: Readonly<{
  header?: React.ReactNode
  children?: React.ReactNode
  pathname?: string
}>) {
  const breadcrumbs = build_breadcrumb_output({ pathname })

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      {header}
      <AdminBreadcrumb items={breadcrumbs.items} />
      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-3 px-5 pb-[calc(118px+env(safe-area-inset-bottom,0px))] pt-2">
        {children ?? (
          <div className="grid gap-3">
            {placeholder_cards.map((card) => (
              <section
                key={card.title}
                className="rounded-[28px] border border-neutral-200 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]"
              >
                <h2 className="text-[15px] font-semibold text-neutral-950">
                  {card.title}
                </h2>
                <p className="mt-2 text-[13px] font-medium text-neutral-500">
                  {card.body}
                </p>
              </section>
            ))}
          </div>
        )}
      </main>
      <OpsAssistant />
    </div>
  )
}
