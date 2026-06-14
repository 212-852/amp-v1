export default function OpsComingSoon({
  title,
}: Readonly<{
  title: string
}>) {
  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white p-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-neutral-950">
        {title}
      </h2>
      <p className="mt-8 text-[24px] font-semibold tracking-[-0.04em] text-neutral-950">
        Coming Soon
      </p>
      <p className="mt-3 text-[14px] font-medium leading-6 text-neutral-500">
        準備中
      </p>
    </section>
  )
}
