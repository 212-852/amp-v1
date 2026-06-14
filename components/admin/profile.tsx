import { UserRound } from "lucide-react"

type AdminProfileProps = {
  display_name?: string
  role_label?: string
}

export default function AdminProfile({
  display_name = "M.OKINO",
  role_label = "admin",
}: Readonly<AdminProfileProps>) {
  return (
    <section className="mt-6 px-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-neutral-200 bg-white text-neutral-700 shadow-[0_4px_14px_rgba(0,0,0,0.04)]">
          <UserRound className="h-8 w-8" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-[22px] font-semibold tracking-[-0.03em] text-neutral-950">
            {display_name}
          </p>
          <p className="mt-1 text-[13px] font-medium text-neutral-500">
            {role_label}
          </p>
        </div>
      </div>
    </section>
  )
}
