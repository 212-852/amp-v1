type RequestHeadersLike = {
  get(name: string): string | null
  has(name: string): boolean
}

export type AccessRequestKind =
  | "direct_navigation"
  | "prefetch"
  | "rsc_fetch"

export function classifyAccessRequest(input: {
  headers: RequestHeadersLike
  search?: string | null
}): AccessRequestKind {
  if (isExplicitPrefetchHeader(input.headers)) {
    return "prefetch"
  }

  const sec_fetch_dest = input.headers.get("sec-fetch-dest")
  const sec_fetch_mode = input.headers.get("sec-fetch-mode")
  const sec_fetch_user = input.headers.get("sec-fetch-user")

  if (sec_fetch_dest === "document" && sec_fetch_mode === "navigate") {
    return "direct_navigation"
  }

  if (sec_fetch_user === "?1") {
    return "direct_navigation"
  }

  if (
    sec_fetch_dest === "empty" &&
    sec_fetch_mode === "cors" &&
    input.headers.has("next-url")
  ) {
    return "prefetch"
  }

  const search = input.search ?? ""

  if (search.includes("_rsc=") || search.includes("?_rsc")) {
    return "rsc_fetch"
  }

  return "direct_navigation"
}

export function isNavigationPrefetchRequest(input: {
  headers: RequestHeadersLike
  search?: string | null
}) {
  const kind = classifyAccessRequest(input)

  return kind === "prefetch" || kind === "rsc_fetch"
}

function isExplicitPrefetchHeader(headers: RequestHeadersLike) {
  const purpose = headers.get("purpose") ?? headers.get("Purpose")

  if (purpose?.toLowerCase() === "prefetch") {
    return true
  }

  const sec_purpose = headers.get("sec-purpose") ?? headers.get("Sec-Purpose")

  if (sec_purpose?.toLowerCase() === "prefetch") {
    return true
  }

  const next_prefetch =
    headers.get("next-router-prefetch") ??
    headers.get("Next-Router-Prefetch")

  if (next_prefetch === "1") {
    return true
  }

  if (headers.get("x-middleware-prefetch") === "1") {
    return true
  }

  return false
}
