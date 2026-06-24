import { NextResponse } from "next/server"

import { get_address_options } from "@/src/address/action"

export async function GET() {
  const options = await get_address_options()

  return NextResponse.json(options)
}
