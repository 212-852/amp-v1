import { headers } from "next/headers"

export type EntranceType = "app" | "corporate" | "airport" | "tokyo" | "unknown"

export type EntranceSurface = "web" | "pwa" | "liff" | "line"

export type EntranceContext = {
  host: string
  type: EntranceType
  surface: EntranceSurface
}

const domainEntranceMap: Record<string, EntranceType> = {
  "app.da-nya.com": "app",
  "test.da-nya.com": "corporate",
  "test.pet-taxi-airport.com": "airport",
  "www.pet-taxi.tokyo": "tokyo",
}

function normalizeHost(host: string | null): string {
  return (host ?? "").split(":")[0]?.toLowerCase() ?? ""
}

function resolveSurface(value: string | null): EntranceSurface {
  if (value === "pwa" || value === "liff" || value === "line") {
    return value
  }

  return "web"
}

export async function resolveEntranceContext(): Promise<EntranceContext> {
  const requestHeaders = await headers()
  const host = normalizeHost(
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  )

  return {
    host,
    type: domainEntranceMap[host] ?? "unknown",
    surface: resolveSurface(requestHeaders.get("x-amp-surface")),
  }
}
