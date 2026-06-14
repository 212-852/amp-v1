export default function AdminComingSoon({
  title,
}: Readonly<{
  title: string
}>) {
  return (
    <section className="w-full rounded-lg border border-neutral-200 bg-white p-6">
      <p className="text-sm font-medium text-neutral-500">
        {title}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-neutral-950">
        Coming Soon
      </h2>
    </section>
  )
}
