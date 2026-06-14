"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { adminPrimaryNav, adminSectionNav } from "@/components/admin/navigation"

function isActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminSectionNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Admin sections"
      className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {adminSectionNav.map((item) => {
        const active = isActive(pathname, item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full border px-3 py-2 text-[12px] font-bold ${
              active
                ? "border-[#111111] bg-[#111111] text-[#ffffff]"
                : "border-[#e5e5e5] bg-[#ffffff] text-[#777777]"
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminFooterNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Admin primary navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e5e5e5] bg-[#ffffff] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid h-16 w-full max-w-[430px] grid-cols-5 px-2 md:max-w-3xl">
        {adminPrimaryNav.map((item) => {
          const Icon = item.icon
          const active = isActive(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
                active ? "text-[#111111]" : "text-[#777777]"
              }`}
            >
              <Icon
                className="h-4 w-4"
                strokeWidth={active ? 2.5 : 2}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
