import OpsAssistant from "@/components/ops/assistant"
import OpsHeader from "@/components/ops/header"
import { resolvePageLabel } from "@/core/ops/page_label"
import type { OpsHeaderSession } from "@/core/ops/header_session"

type HeaderBreadcrumbItem = {
  label: string
  href?: string
}

function resolve_header_offset(has_breadcrumb: boolean) {
  return has_breadcrumb
    ? "pt-[calc(112px+env(safe-area-inset-top,0px))]"
    : "pt-[calc(96px+env(safe-area-inset-top,0px))]"
}

export default function OpsShell({
  children,
  session,
  pathname,
  show_assistant = pathname === "/admin" || pathname === "/driver",
  breadcrumb_items = [],
  layout = "default",
}: Readonly<{
  children: React.ReactNode
  session: OpsHeaderSession
  pathname: string
  show_assistant?: boolean
  breadcrumb_items?: HeaderBreadcrumbItem[]
  layout?: "default" | "full_height"
}>) {
  const page_label = resolvePageLabel(pathname)
  const has_breadcrumb = breadcrumb_items.length > 0
  const header_offset = resolve_header_offset(has_breadcrumb)

  if (layout === "full_height") {
    return (
      <div className="min-h-dvh bg-neutral-50 text-neutral-900">
        <OpsHeader
          session={session}
          page_label={page_label}
          breadcrumb_items={breadcrumb_items}
        />
        <main
          className={`mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden px-5 ${header_offset}`}
        >
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900">
      <OpsHeader
        session={session}
        page_label={page_label}
        breadcrumb_items={breadcrumb_items}
      />
      <main
        className={[
          "mx-auto flex w-full max-w-[430px] flex-col gap-3 px-5",
          header_offset,
          show_assistant
            ? "pb-[calc(118px+env(safe-area-inset-bottom,0px))]"
            : "pb-4",
        ].join(" ")}
      >
        {children}
      </main>
      {show_assistant ? <OpsAssistant /> : null}
    </div>
  )
}
