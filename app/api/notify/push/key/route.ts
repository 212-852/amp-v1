import { NextResponse } from "next/server"

import { getPushNotificationPublicKeyConfig } from "@/core/notify/push_action"
import {
  buildPushKeyMissingOutput,
  buildPushKeyOutput,
} from "@/core/notify/push_output"

export const runtime = "nodejs"

export async function GET() {
  const { public_key, missing_env } = await getPushNotificationPublicKeyConfig()

  if (!public_key && missing_env) {
    return NextResponse.json(buildPushKeyMissingOutput(missing_env), {
      status: 500,
    })
  }

  return NextResponse.json(buildPushKeyOutput(public_key))
}
