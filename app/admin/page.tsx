import {
  AlertTriangle,
  Bell,
  CarFront,
  ClipboardList,
  Gauge,
  Menu,
  MessageCircle,
  Radio,
  UserRound,
} from "lucide-react"
import Image from "next/image"

const actionRequired = [
  {
    priority: "High",
    title: "Assign airport pickup",
    detail: "Haneda T3 arrival changed to 14:20",
    age: "2m",
  },
  {
    priority: "High",
    title: "Confirm pet crate size",
    detail: "Corporate booking requires driver approval",
    age: "6m",
  },
  {
    priority: "Med",
    title: "Payment review",
    detail: "Card authorization pending for order #A-1842",
    age: "11m",
  },
]

const conciergeRequests = [
  { channel: "LINE", customer: "M. Tanaka", topic: "Airport pickup", wait: "1m" },
  { channel: "Web", customer: "K. Sato", topic: "Dog carrier", wait: "4m" },
  { channel: "PWA", customer: "A. Ito", topic: "Driver location", wait: "8m" },
]

const activeOrders = [
  { id: "A-1842", time: "11:30", route: "Shibuya -> Haneda", status: "Ready" },
  {
    id: "A-1843",
    time: "12:10",
    route: "Setagaya pet clinic",
    status: "En route",
  },
  {
    id: "A-1844",
    time: "14:20",
    route: "Haneda Terminal 3",
    status: "Needs driver",
  },
]

const activeDrivers = [
  { name: "Aoki", state: "On trip", zone: "Meguro", orders: "2" },
  { name: "Sato", state: "Available", zone: "Shinjuku", orders: "0" },
  { name: "Kimura", state: "Break", zone: "Minato", orders: "1" },
]

const notifications = [
  "Narita arrival monitor updated",
  "Driver Sato entered Shinjuku zone",
  "Concierge queue exceeded 3 minutes",
]

const navItems = [
  { label: "Dashboard", icon: Gauge },
  { label: "Orders", icon: ClipboardList },
  { label: "Drivers", icon: CarFront },
  { label: "Chat", icon: MessageCircle },
  { label: "Menu", icon: Menu },
]

function OperationCard({
  title,
  meta,
  children,
}: Readonly<{
  title: string
  meta?: string
  children: React.ReactNode
}>) {
  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-[#ffffff] p-4 shadow-[0_8px_22px_rgba(17,17,17,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold tracking-[-0.01em] text-[#111111]">
          {title}
        </h2>
        {meta ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#777777]">
            {meta}
          </p>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function StatusDot({ active = false }: Readonly<{ active?: boolean }>) {
  return (
    <span
      className={`h-2.5 w-2.5 rounded-full ${
        active ? "bg-[#8b5a2b]" : "bg-[#d9d9d9]"
      }`}
    />
  )
}

function RoboNekoAssistant() {
  const states = ["notification", "thinking", "speaking"]

  return (
    <aside className="fixed bottom-[calc(88px+env(safe-area-inset-bottom,0px))] right-3 z-40 w-[168px] rounded-2xl border border-[#e5e5e5] bg-[#ffffff] p-3 shadow-[0_12px_28px_rgba(17,17,17,0.12)] md:bottom-6 md:right-6 md:w-[220px]">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-[#e5e5e5] bg-[#f5f5f5]">
          <Image
            src="/images/robo_neko.svg"
            alt="roboNeko"
            width={48}
            height={58}
            unoptimized
            className="h-12 w-12 object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-[#111111]">AI Assistant</p>
          <p className="mt-0.5 text-[10px] font-semibold leading-tight text-[#777777]">
            Operations / Dispatch / Support
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5">
        {states.map((state) => (
          <div
            key={state}
            className="flex items-center justify-between rounded-full border border-[#e5e5e5] px-2.5 py-1 text-[10px] font-semibold text-[#777777]"
          >
            <span className="capitalize">{state}</span>
            <StatusDot active={state === "notification"} />
          </div>
        ))}
      </div>
    </aside>
  )
}

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-[#f5f5f5] text-[#111111]">
      <header className="border-b border-[#e5e5e5] bg-[#ffffff] px-4 pt-[calc(14px+env(safe-area-inset-top,0px))]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#777777]">
              AMP Admin
            </p>
            <h1 className="mt-1 text-[22px] font-bold tracking-[-0.03em] text-[#111111]">
              Operations Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e5e5e5] bg-[#ffffff] text-[#111111]"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-[#ffffff]"
              aria-label="Admin account"
            >
              <UserRound className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-[calc(184px+env(safe-area-inset-bottom,0px))] pt-4 md:grid-cols-[1.35fr_1fr] md:pb-10">
        <div className="grid gap-4">
          <OperationCard title="Action Required" meta="Priority">
            <div className="grid gap-2">
              {actionRequired.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-[#e5e5e5] bg-[#ffffff] px-3 py-3 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111111] text-[#ffffff]">
                    <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-[#111111]">
                        {item.title}
                      </span>
                      <span className="rounded-full bg-[#8b5a2b] px-2 py-0.5 text-[10px] font-bold text-[#ffffff]">
                        {item.priority}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-[12px] font-medium text-[#777777]">
                      {item.detail}
                    </span>
                  </span>
                  <span className="text-[11px] font-bold text-[#777777]">
                    {item.age}
                  </span>
                </button>
              ))}
            </div>
          </OperationCard>

          <OperationCard title="Concierge Requests" meta="Live queue">
            <div className="grid gap-2">
              {conciergeRequests.map((request) => (
                <div
                  key={`${request.channel}-${request.customer}`}
                  className="grid grid-cols-[54px_1fr_42px] items-center gap-3 rounded-xl border border-[#e5e5e5] px-3 py-3"
                >
                  <span className="rounded-lg bg-[#f5f5f5] px-2 py-1 text-center text-[11px] font-bold text-[#111111]">
                    {request.channel}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[#111111]">
                      {request.customer}
                    </p>
                    <p className="mt-1 truncate text-[12px] font-medium text-[#777777]">
                      {request.topic}
                    </p>
                  </div>
                  <p className="text-right text-[12px] font-bold text-[#8b5a2b]">
                    {request.wait}
                  </p>
                </div>
              ))}
            </div>
          </OperationCard>

          <OperationCard title="Active Orders" meta="No tables">
            <div className="grid gap-2">
              {activeOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-[#e5e5e5] px-3 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[13px] font-bold text-[#111111]">
                      {order.id} / {order.time}
                    </p>
                    <p className="rounded-full border border-[#e5e5e5] px-2.5 py-1 text-[11px] font-bold text-[#111111]">
                      {order.status}
                    </p>
                  </div>
                  <p className="mt-2 text-[12px] font-medium text-[#777777]">
                    {order.route}
                  </p>
                </div>
              ))}
            </div>
          </OperationCard>
        </div>

        <div className="grid content-start gap-4">
          <OperationCard title="Active Drivers" meta="Dispatch">
            <div className="grid gap-2">
              {activeDrivers.map((driver) => (
                <div
                  key={driver.name}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-[#e5e5e5] px-3 py-3"
                >
                  <div>
                    <p className="text-[13px] font-bold text-[#111111]">
                      {driver.name}
                    </p>
                    <p className="mt-1 text-[12px] font-medium text-[#777777]">
                      {driver.zone} / {driver.orders} active
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] font-bold text-[#111111]">
                    <StatusDot active={driver.state !== "Break"} />
                    {driver.state}
                  </div>
                </div>
              ))}
            </div>
          </OperationCard>

          <OperationCard title="Notifications" meta="System">
            <div className="grid gap-2">
              {notifications.map((notification) => (
                <div
                  key={notification}
                  className="flex items-start gap-3 rounded-xl border border-[#e5e5e5] px-3 py-3"
                >
                  <Radio
                    className="mt-0.5 h-4 w-4 text-[#8b5a2b]"
                    strokeWidth={2}
                  />
                  <p className="text-[12px] font-medium leading-5 text-[#777777]">
                    {notification}
                  </p>
                </div>
              ))}
            </div>
          </OperationCard>

          <OperationCard title="roboNeko Assistant" meta="Always on">
            <div className="flex items-center gap-4 rounded-xl border border-[#e5e5e5] bg-[#f5f5f5] p-3">
              <Image
                src="/images/robo_neko.svg"
                alt="roboNeko"
                width={80}
                height={96}
                unoptimized
                className="h-20 w-20 object-contain"
              />
              <div>
                <p className="text-[14px] font-bold text-[#111111]">
                  AI Assistant
                </p>
                <p className="mt-1 text-[12px] font-medium leading-5 text-[#777777]">
                  Operations / Dispatch / Support
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["idle", "thinking", "speaking", "warning"].map((state) => (
                    <span
                      key={state}
                      className="rounded-full border border-[#e5e5e5] bg-[#ffffff] px-2 py-1 text-[10px] font-bold text-[#777777]"
                    >
                      {state}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </OperationCard>
        </div>
      </main>

      <RoboNekoAssistant />

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#e5e5e5] bg-[#ffffff] pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto grid h-16 w-full max-w-[430px] grid-cols-5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.label}
                type="button"
                className="flex flex-col items-center justify-center gap-1 text-[10px] font-semibold text-[#777777]"
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
