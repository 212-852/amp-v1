export default function AdminRenderFallback({
  message,
}: Readonly<{
  message?: string
}>) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 px-6 text-neutral-900">
      <section className="w-full max-w-[430px] rounded-[28px] border border-neutral-200 bg-white px-5 py-6 shadow-[0_8px_24px_rgba(0,0,0,0.04)]">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-neutral-950">
          Admin page failed to render
        </h1>
        <p className="mt-2 text-[13px] font-medium leading-5 text-neutral-500">
          The admin shell could not be loaded. Check debug logs for
          admin_page_render_failed.
        </p>
        {process.env.NODE_ENV !== "production" && message ? (
          <pre className="mt-4 overflow-x-auto rounded-[16px] bg-neutral-100 p-3 text-[11px] leading-5 text-neutral-700">
            {message}
          </pre>
        ) : null}
      </section>
    </div>
  )
}
