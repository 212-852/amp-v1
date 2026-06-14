export default function AdminCard({
  title,
  children,
}: Readonly<{
  title: string
  children: React.ReactNode
}>) {
  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}
