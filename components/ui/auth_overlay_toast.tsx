"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export default function AuthOverlayToast({
  message,
}: Readonly<{
  message: string | null
}>) {
  const [mounted, set_mounted] = useState(false)

  useEffect(() => {
    set_mounted(true)
  }, [])

  if (!mounted || !message) {
    return null
  }

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[99999] flex items-center justify-center"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 99999,
        pointerEvents: "none",
      }}
    >
      <div
        role="status"
        aria-live="polite"
        className="min-w-[220px] max-w-[calc(100vw-48px)] rounded-[18px] bg-[rgba(0,0,0,0.82)] px-6 py-[18px] text-center text-[13px] font-semibold leading-snug text-white shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-[12px]"
        style={{
          background: "rgba(0,0,0,0.82)",
          color: "white",
          borderRadius: 18,
          padding: "18px 24px",
          minWidth: 220,
          maxWidth: "calc(100vw - 48px)",
          textAlign: "center",
          backdropFilter: "blur(12px)",
        }}
      >
        <span className="whitespace-pre-line">{message}</span>
      </div>
    </div>,
    document.body,
  )
}
