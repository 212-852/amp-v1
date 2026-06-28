"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

export default function OnboardingTaskShell({
  title,
  children,
}: Readonly<{
  title: string
  children: ReactNode
}>) {
  return (
    <main className="min-h-dvh bg-gradient-to-b from-neutral-50 to-white">
      <div className="mx-auto flex w-full max-w-lg flex-col px-5 pb-10 pt-6">
        <header className="mb-6 space-y-4">
          <Link
            href="/driver"
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition hover:text-neutral-900"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
            稼働準備
          </Link>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              稼働準備
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
              {title}
            </h1>
          </div>
        </header>

        {children}
      </div>
    </main>
  )
}
