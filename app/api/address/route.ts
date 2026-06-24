import { NextResponse } from "next/server"

import { get_address_options } from "@/src/address/action"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const options = await get_address_options({
    prefecture_code: url.searchParams.get("prefecture_code"),
    city_code: url.searchParams.get("city_code"),
  })

  return NextResponse.json(options)
}
