import AppPageShell from "@/components/app/page_shell"
import PartnerHero from "@/components/app/partner_hero"
import { resolveAuthContext } from "@/core/auth/context"
import { resolveSession } from "@/core/auth/session"
import { build_breadcrumb_output } from "@/core/breadcrumb/output"
import {
  build_partner_liff_guidance_text,
  PARTNER_DRIVER_REGISTER_PATH,
} from "@/core/partner/recruitment"

export default async function PartnerDriverPage() {
  const context = await resolveAuthContext("/partner")
  const session = await resolveSession(context)
  const breadcrumbs = build_breadcrumb_output({ pathname: "/partner" })

  return (
    <AppPageShell auth={session} breadcrumb_items={breadcrumbs.items}>
      <section className="flex flex-col gap-6">
        <PartnerHero />

        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold leading-tight text-[#3d2a19]">
            パートナードライバー募集
          </h2>
          <p className="text-base leading-8 text-[#6f5842]">
            ペットとご家族の移動を、やさしく支えるお仕事です。
          </p>
        </div>

        <div className="flex flex-col items-center gap-6 pb-4">
          <a
            href={PARTNER_DRIVER_REGISTER_PATH}
            className="inline-flex h-12 min-w-[220px] items-center justify-center rounded-full bg-[#06c755] px-8 text-sm font-bold text-white shadow-[0_8px_18px_rgba(6,199,85,0.24)]"
          >
            登録フォームへ
          </a>

          <p className="whitespace-pre-line text-center text-sm leading-7 text-[#6f5842]">
            {build_partner_liff_guidance_text()}
          </p>
        </div>
      </section>
    </AppPageShell>
  )
}
