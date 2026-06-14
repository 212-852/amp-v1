import {
  CarFront,
  ClipboardList,
  Gauge,
  Menu,
  MessageCircle,
  UserRound,
} from "lucide-react"

const statusCards = [
  { label: "Open Orders", value: "18", detail: "5 airport pickups" },
  { label: "Active Drivers", value: "7", detail: "2 on break" },
  { label: "Concierge Queue", value: "4", detail: "Avg wait 3 min" },
]

const actionItems = [
  { title: "Assign driver", detail: "Haneda pickup at 14:20" },
  { title: "Confirm delay", detail: "Narita arrival changed" },
  { title: "Review payment", detail: "Corporate booking pending" },
]

const orders = [
  { time: "11:30", route: "Shibuya to Haneda", status: "Ready" },
  { time: "12:10", route: "Setagaya pet clinic", status: "Driver assigned" },
  { time: "14:20", route: "Haneda Terminal 3", status: "Needs driver" },
]

const drivers = [
  { name: "Aoki", status: "On trip", load: "2 orders" },
  { name: "Sato", status: "Available", load: "Near Shinjuku" },
  { name: "Kimura", status: "Break", load: "Back 13:00" },
]

const concierge = [
  { label: "Bot handled", value: "42" },
  { label: "Human active", value: "4" },
  { label: "Escalations", value: "2" },
]

const navItems = [
  { label: "Dashboard", icon: Gauge },
  { label: "Orders", icon: ClipboardList },
  { label: "Drivers", icon: CarFront },
  { label: "Chat", icon: MessageCircle },
  { label: "Menu", icon: Menu },
]

function SectionCard({
  title,
  children,
}: Readonly<{
  title: string
  children: React.ReactNode
}>) {
  return (
    <section className="rounded-[30px] bg-[#fdfaf6] p-5 shadow-[0_12px_28px_rgba(107,74,38,0.13)]">
      <h2 className="text-[15px] font-black text-[#3d2a19]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function AdminPage() {
  return (
    <div className="min-h-dvh bg-[#f5e8d5] text-[#3d2a19]">
      <header className="bg-[#ead7c3] px-5 pb-5 pt-[calc(16px+env(safe-area-inset-top,0px))]">
        <p className="text-[12px] font-black tracking-[0.08em] text-[#8c7358]">
          PET TAXI ADMIN
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-black leading-none">Dashboard</h1>
            <p className="mt-2 text-[13px] font-semibold text-[#8c7358]">
              Today operations
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8f5d28] text-[#fdfaf6]">
            <UserRound className="h-5 w-5" strokeWidth={2} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[430px] gap-4 px-4 pb-[calc(112px+env(safe-area-inset-bottom,0px))] pt-4">
        <SectionCard title="Today's Status">
          <div className="grid gap-3">
            {statusCards.map((card) => (
              <div
                key={card.label}
                className="rounded-[26px] bg-[#e8d2b3] px-4 py-3"
              >
                <p className="text-[12px] font-bold text-[#8c7358]">
                  {card.label}
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p className="text-[28px] font-black leading-none">
                    {card.value}
                  </p>
                  <p className="text-right text-[12px] font-semibold text-[#8c7358]">
                    {card.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Action Required">
          <div className="grid gap-3">
            {actionItems.map((item) => (
              <button
                key={item.title}
                type="button"
                className="rounded-[26px] bg-[#8f5d28] px-4 py-4 text-left text-[#fdfaf6] shadow-[0_7px_14px_rgba(122,78,34,0.22)]"
              >
                <span className="block text-[15px] font-black">
                  {item.title}
                </span>
                <span className="mt-1 block text-[12px] font-semibold opacity-80">
                  {item.detail}
                </span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Today's Orders">
          <div className="grid gap-3">
            {orders.map((order) => (
              <div
                key={`${order.time}-${order.route}`}
                className="rounded-[26px] bg-[#fdfaf6] px-4 py-3 shadow-[inset_0_0_0_1px_#dcc7aa]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[18px] font-black">{order.time}</p>
                  <p className="rounded-full bg-[#e8d2b3] px-3 py-1 text-[11px] font-black text-[#8c7358]">
                    {order.status}
                  </p>
                </div>
                <p className="mt-2 text-[13px] font-semibold text-[#8c7358]">
                  {order.route}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Driver Status">
          <div className="grid gap-3">
            {drivers.map((driver) => (
              <div
                key={driver.name}
                className="flex items-center justify-between gap-3 rounded-[26px] bg-[#e8d2b3] px-4 py-3"
              >
                <div>
                  <p className="text-[15px] font-black">{driver.name}</p>
                  <p className="mt-1 text-[12px] font-semibold text-[#8c7358]">
                    {driver.load}
                  </p>
                </div>
                <p className="text-right text-[13px] font-black text-[#8f5d28]">
                  {driver.status}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Concierge Status">
          <div className="grid grid-cols-3 gap-2">
            {concierge.map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] bg-[#e8d2b3] px-3 py-4 text-center"
              >
                <p className="text-[22px] font-black leading-none">
                  {item.value}
                </p>
                <p className="mt-2 text-[11px] font-bold leading-tight text-[#8c7358]">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Sales Summary">
          <div className="rounded-[26px] bg-[#e8d2b3] px-4 py-4">
            <p className="text-[12px] font-bold text-[#8c7358]">
              Today gross sales
            </p>
            <p className="mt-2 text-[30px] font-black leading-none">
              ¥284,000
            </p>
            <p className="mt-3 text-[13px] font-semibold text-[#8c7358]">
              Corporate accounts: ¥96,000 / Airport: ¥142,000
            </p>
          </div>
        </SectionCard>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 bg-[#ead7c3] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid h-20 w-full max-w-[430px] grid-cols-5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon

            return (
              <button
                key={item.label}
                type="button"
                className="flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-[#8f5d28]"
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
