export default function AdminOperationCard({
  title,
  meta,
  children,
}: Readonly<{
  title: string
  meta?: string
  children: React.ReactNode
}>) {
  return (
    <section className="rounded-xl border border-[#e5e5e5] bg-[#ffffff] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[#111111]">
          {title}
        </h2>
        {meta ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#777777]">
            {meta}
          </p>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}
