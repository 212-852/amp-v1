import { normalize_breadcrumb_context } from "@/core/breadcrumb/context"
import { resolve_breadcrumb_items } from "@/core/breadcrumb/rules"

export function build_breadcrumb_output(input: {
  pathname?: string | null
  room_name?: string | null
}) {
  const context = normalize_breadcrumb_context(input)

  return {
    items: resolve_breadcrumb_items(context),
  }
}
