"use client"

import { useEffect, useState } from "react"

import { PWA_OFFLINE_EVENT, PWA_ONLINE_EVENT } from "@/components/pwa/events"
import { isStandalonePwa } from "@/components/pwa/runtime"

const content = {
  title: {
    ja: "オフライン",
    en: "Offline",
    es: "Sin conexion",
  },
  body: {
    ja: "ネットワークに接続できません。接続が復旧すると自動的に再試行します。",
    en: "Network unavailable. We will retry automatically when you are back online.",
    es: "Sin red. Reintentaremos automaticamente cuando vuelva la conexion.",
  },
}

export function PwaOfflineScreen() {
  const [visible, set_visible] = useState(false)

  useEffect(() => {
    if (!isStandalonePwa()) {
      return
    }

    function show_offline() {
      set_visible(true)
    }

    function hide_offline() {
      set_visible(false)
    }

    window.addEventListener(PWA_OFFLINE_EVENT, show_offline)
    window.addEventListener(PWA_ONLINE_EVENT, hide_offline)
    window.addEventListener("online", hide_offline)

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      set_visible(true)
    }

    return () => {
      window.removeEventListener(PWA_OFFLINE_EVENT, show_offline)
      window.removeEventListener(PWA_ONLINE_EVENT, hide_offline)
      window.removeEventListener("online", hide_offline)
    }
  }, [])

  if (!visible) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f5e8d5] px-6 text-[#3d2a19]">
      <div className="w-full max-w-[360px] rounded-3xl border border-[#eadfce] bg-[#fffdf9] px-6 py-7 text-center shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
        <h1 className="text-[20px] font-bold">{content.title.ja}</h1>
        <p className="mt-3 text-[14px] leading-7 text-[#6a5a50]">{content.body.ja}</p>
      </div>
    </div>
  )
}
