"use client"

import AppChatSection from "@/components/app/chat_section"
import type { ChatRoomState } from "@/core/chat/types"
import { useLocale } from "@/src/components/locale/provider"

const content = {
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

export default function AppHome({
  chat_state,
}: Readonly<{
  chat_state: ChatRoomState | null
}>) {
  const { locale } = useLocale()

  return (
    <main className="mx-auto w-full max-w-[390px] px-4 pb-[calc(196px+env(safe-area-inset-bottom,0px))] pt-[118px]">
      <div className="space-y-4">
        <AppChatSection chat_state={chat_state} />

        <section className="rounded-[36px] bg-[#fdfaf6] p-5 shadow-[0_12px_28px_rgba(107,74,38,0.13)]">
          <div className="rounded-[30px] bg-[#e8d2b3] px-4 py-4">
            <p className="text-[13px] font-black text-[#3d2a19]">
              {content.support_title[locale]}
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[#8c7358]">
              {content.support_description[locale]}
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
