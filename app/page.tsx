import { redirect } from "next/navigation"

import Footer from "@/components/layout/footer"
import Header from "@/components/layout/header"
import { resolveAmpRoute } from "@/core/route/rules"

export default async function Page() {
  const route = await resolveAmpRoute()

  if (route.path !== "/") {
    redirect(route.path)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 text-neutral-900">
      <Header title={route.title} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8">
        <section className="rounded-lg border border-neutral-200 bg-white p-6">
          <p className="text-sm font-medium text-neutral-500">AMP Core</p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-950">
            App Top
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Shared entrance routing is active for the app domain.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
