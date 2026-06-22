import AppPageShell from "@/components/app/page_shell"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { build_breadcrumb_output } from "@/core/breadcrumb/output"
import { DRIVER_PARTNER_LIFF_URL } from "@/core/chat/rules"

export default async function PartnerDriverPage() {
  const context = await resolveAuthContext("/partner")
  const session = await resolveSession(context)
  const breadcrumbs = build_breadcrumb_output({ pathname: "/partner" })

  return (
    <AppPageShell auth={session} breadcrumb_items={breadcrumbs.items}>
      <section className="flex flex-col gap-8">
        <div className="space-y-4">
          <p className="text-sm font-semibold text-[#8f5d28]">
            PARTNER DRIVER
          </p>
          <h2 className="text-3xl font-bold leading-tight sm:text-5xl">
            Partner Driver Program
          </h2>
          <p className="text-base leading-8 text-[#6f5842]">
            ペットとご家族の移動をサポートする
            <br />
            パートナードライバー募集
          </p>
        </div>

        <a
          href={DRIVER_PARTNER_LIFF_URL}
          className="inline-flex h-12 w-fit items-center justify-center rounded-md bg-[#06c755] px-6 text-sm font-bold text-white"
        >
          Join via LINE
        </a>
      </section>
    </AppPageShell>
  )
}
