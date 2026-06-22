export type LineUriRejectReason =
  | "empty"
  | "null"
  | "unsupported_scheme"
  | "invalid_url"
  | "missing_public_app_url"

export type LineUriNormalizeReason = "absolute_https" | "relative_converted"

export type LineUriNormalizeResult =
  | {
      ok: true
      uri: string
      reason: LineUriNormalizeReason
    }
  | {
      ok: false
      reason: LineUriRejectReason
    }

export function resolve_public_app_url() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")

  return raw.replace(/\/$/, "")
}

export function normalize_line_uri(value: unknown): LineUriNormalizeResult {
  if (value === null || value === undefined) {
    return { ok: false, reason: "null" }
  }

  if (typeof value !== "string") {
    return { ok: false, reason: "empty" }
  }

  const trimmed = value.trim()

  if (!trimmed) {
    return { ok: false, reason: "empty" }
  }

  if (trimmed.startsWith("/")) {
    const base = resolve_public_app_url()

    if (!base) {
      return { ok: false, reason: "missing_public_app_url" }
    }

    return {
      ok: true,
      uri: `${base}${trimmed}`,
      reason: "relative_converted",
    }
  }

  try {
    const url = new URL(trimmed)

    if (url.protocol !== "https:") {
      return { ok: false, reason: "unsupported_scheme" }
    }

    return {
      ok: true,
      uri: url.toString(),
      reason: "absolute_https",
    }
  } catch {
    return { ok: false, reason: "invalid_url" }
  }
}
