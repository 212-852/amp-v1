import { NextResponse } from "next/server"

import { getPushNotificationPublicKey } from "@/core/notify/push_action"
import { buildPushKeyOutput } from "@/core/notify/push_output"

export async function GET() {
  const public_key = await getPushNotificationPublicKey()

  return NextResponse.json(buildPushKeyOutput(public_key))
}

