export default function AdminComingSoon({
  title,
}: Readonly<{
  title: string
}>) {
  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-[#ffffff] p-6 shadow-[0_8px_22px_rgba(17,17,17,0.04)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#777777]">
        {title}
      </p>
      <h2 className="mt-3 text-[24px] font-bold tracking-[-0.03em] text-[#111111]">
        Coming Soon
      </h2>
    </section>
  )
}
