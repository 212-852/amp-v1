import { redirect } from "next/navigation"

import { PARTNER_DRIVER_REGISTER_PATH } from "@/core/partner/recruitment"

export async function GET() {
  redirect(PARTNER_DRIVER_REGISTER_PATH)
}
