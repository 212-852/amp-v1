import { enforce_entry_line_access } from "@/core/route/rules"
import AppPageShell from "@/components/app/page_shell"
import PartnerHero from "@/components/app/partner_hero"
import EntryForm from "@/components/app/entry_form"
import { build_breadcrumb_output } from "@/core/breadcrumb/output"
import { build_entry_form_initial } from "@/core/entry/context"
import { get_profile_settings } from "@/core/profile/action"

export default async function EntryPage() {
  const guard = await enforce_entry_line_access()
  const profile = await get_profile_settings(guard.session)
  const initial = build_entry_form_initial({
    session: guard.session,
    profile,
  })
  const breadcrumbs = build_breadcrumb_output({ pathname: "/entry" })

  return (
    <AppPageShell auth={guard.session} breadcrumb_items={breadcrumbs.items}>
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

        <div className="pb-4">
          <EntryForm initial={initial} />
        </div>
      </section>
    </AppPageShell>
  )
}
