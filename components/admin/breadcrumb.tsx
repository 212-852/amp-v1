import Link from "next/link"

import type { BreadcrumbItem } from "@/core/breadcrumb/rules"

export default function AdminBreadcrumb({
  items,
}: Readonly<{
  items: BreadcrumbItem[]
}>) {
  if (items.length === 0) {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="mx-auto w-full max-w-[430px] px-5 pb-1 pt-[calc(82px+env(safe-area-inset-top,0px))] text-[11px] font-medium text-neutral-400"
    >
      <ol className="flex min-w-0 items-center gap-1.5">
        {items.map((item, index) => {
          const is_last = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              {index > 0 ? <span aria-hidden="true">&gt;</span> : null}
              {item.href && !is_last ? (
                <Link
                  href={item.href}
                  className="shrink-0 transition hover:text-neutral-600"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate text-neutral-500">{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
