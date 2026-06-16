import type { Session } from "@/core/auth/types"

export default function AdminSessionPanel({
  session,
}: Readonly<{
  session: Session
}>) {
  return (
    <section className="rounded-[28px] border border-neutral-200 bg-white px-5 py-4">
      <h1 className="text-[18px] font-semibold text-neutral-950">Admin restore step 1</h1>
      <dl className="mt-4 space-y-2 text-[13px] text-neutral-700">
        <div>
          <dt className="font-medium text-neutral-500">user_uuid</dt>
          <dd>{session.user_uuid ?? "null"}</dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-500">role</dt>
          <dd>{session.role ?? "null"}</dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-500">tier</dt>
          <dd>{session.tier ?? "null"}</dd>
        </div>
        <div>
          <dt className="font-medium text-neutral-500">display_name</dt>
          <dd>{session.display_name ?? "null"}</dd>
        </div>
      </dl>
    </section>
  )
}
