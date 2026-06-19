export type BreadcrumbContext = {
  pathname: string
  room_name?: string | null
}

export function normalize_breadcrumb_context(input: {
  pathname?: string | null
  room_name?: string | null
}): BreadcrumbContext {
  return {
    pathname: input.pathname?.trim() || "/",
    room_name: input.room_name?.trim() || null,
  }
}
