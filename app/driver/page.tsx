import Footer from "@/components/layout/footer"
import Header from "@/components/layout/header"

export default function DriverPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 text-neutral-900">
      <Header title="Driver Top" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 px-4 py-8">
        <section className="w-full rounded-lg border border-neutral-200 bg-white p-6">
          <p className="text-sm font-medium text-neutral-500">AMP Core</p>
          <h1 className="mt-2 text-2xl font-semibold text-neutral-950">
            Driver Top
          </h1>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Placeholder page for driver users.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  )
}
