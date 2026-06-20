export type DisplayNameProfile = {
  nickname?: string | null
  first_name?: string | null
  last_name?: string | null
  display_name?: string | null
}

export type DisplayNameIdentity = {
  line_name?: string | null
  name?: string | null
  display_name?: string | null
  email?: string | null
  role?: string | null
  fallback?: string | null
}

function clean_name(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function get_display_name(
  profile?: DisplayNameProfile | null,
  identity?: DisplayNameIdentity | null,
) {
  const full_name = [profile?.first_name, profile?.last_name]
    .map(clean_name)
    .filter(Boolean)
    .join(" ")

  return (
    clean_name(profile?.nickname) ??
    clean_name(identity?.line_name) ??
    clean_name(identity?.name) ??
    clean_name(identity?.display_name) ??
    clean_name(full_name) ??
    clean_name(identity?.email) ??
    clean_name(identity?.role) ??
    clean_name(identity?.fallback) ??
    "Guest"
  )
}
