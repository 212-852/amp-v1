import { redirect } from "next/navigation"

import { enforce_entry_line_access } from "@/core/route/rules"
import { PARTNER_DRIVER_LIFF_URL } from "@/core/partner/recruitment"

export default async function EntryPage() {
  await enforce_entry_line_access()
  redirect(PARTNER_DRIVER_LIFF_URL)
}
