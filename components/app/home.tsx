"use client"

import { useLocale } from "@/src/components/locale/provider"

const content = {
  quick_menu_title: {
    ja: "Quick Menu",
    en: "Quick Menu",
    es: "Menu rapido",
  },
  availability: {
    ja: "空き状況を確認",
    en: "Check availability",
    es: "Ver disponibilidad",
  },
  reserve: {
    ja: "予約する",
    en: "Reserve",
    es: "Reservar",
  },
  check_reservation: {
    ja: "予約を確認する",
    en: "Check reservation",
    es: "Ver reserva",
  },
  share_meeting_place: {
    ja: "待ち合わせ場所を共有",
    en: "Share meeting place",
    es: "Compartir punto de encuentro",
  },
  cancel_reservation: {
    ja: "予約をキャンセル",
    en: "Cancel reservation",
    es: "Cancelar reserva",
  },
  support_title: {
    ja: "サポート",
    en: "Support",
    es: "Soporte",
  },
  support_description: {
    ja: "予約や待ち合わせ場所について、必要なときにサポートを確認できます。",
    en: "Check support when you need help with reservations or meeting places.",
    es: "Consulta soporte cuando necesites ayuda con reservas o puntos de encuentro.",
  },
}

export default function AppHome() {
  const { locale } = useLocale()
  const quick_menu_items = [
    content.availability[locale],
    content.reserve[locale],
    content.check_reservation[locale],
    content.share_meeting_place[locale],
    content.cancel_reservation[locale],
  ]

  return (
    <main className="mx-auto w-full max-w-[390px] px-4 pb-[calc(196px+env(safe-area-inset-bottom,0px))] pt-[118px]">
      <section className="rounded-[36px] bg-[#fdfaf6] p-5 shadow-[0_12px_28px_rgba(107,74,38,0.13)]">
        <div className="rounded-[30px] bg-[#fdfaf6] px-4 py-5 shadow-[inset_0_0_0_1px_#dcc7aa]">
          <p className="text-[12px] font-black tracking-[0.08em] text-[#8c7358]">
            {content.quick_menu_title[locale]}
          </p>
          <div className="mt-4 grid gap-3">
            {quick_menu_items.map((item) => (
              <button
                key={item}
                type="button"
                className="h-[58px] rounded-[30px] bg-[#8f5d28] px-5 text-left text-[15px] font-black text-[#fdfaf6] shadow-[0_7px_14px_rgba(122,78,34,0.22)] hover:bg-[#7d4f20]"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-[30px] bg-[#e8d2b3] px-4 py-4">
          <p className="text-[13px] font-black text-[#3d2a19]">
            {content.support_title[locale]}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[#8c7358]">
            {content.support_description[locale]}
          </p>
        </div>
      </section>
    </main>
  )
}
