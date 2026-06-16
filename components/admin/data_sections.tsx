import type { AdminDashboardData } from "@/core/admin/data"

function DataCard({
  title,
  value,
  fallback,
}: Readonly<{
  title: string
  value: string | null | undefined
  fallback: string
}>) {
  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <h2 className="text-[15px] font-semibold text-neutral-950">{title}</h2>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-neutral-950">
        {value ?? fallback}
      </p>
    </section>
  )
}

export default function AdminDataSections({
  data,
}: Readonly<{
  data: AdminDashboardData
}>) {
  return (
    <div className="grid gap-3">
      <DataCard
        title={data.orders?.label ?? "Orders"}
        value={data.orders?.value}
        fallback="Unavailable"
      />
      <DataCard
        title={data.drivers?.label ?? "Drivers"}
        value={data.drivers?.value}
        fallback="Unavailable"
      />
      <DataCard
        title={data.notifications?.label ?? "Notifications"}
        value={data.notifications?.value}
        fallback="Unavailable"
      />
    </div>
  )
}
