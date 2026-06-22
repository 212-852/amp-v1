"use client"

import { MessageCircle } from "lucide-react"
import { useState } from "react"

import { useToast } from "@/components/ui/use_toast"
import { concierge_toggle_content } from "@/core/ops/concierge_toggle_content"
import { useLocale } from "@/src/components/locale/provider"

type NotificationAvailabilityToggleProps = {
  enabled: boolean
  can_toggle: boolean
  onChanged?: (enabled: boolean) => void
}

export default function NotificationAvailabilityToggle({
  enabled,
  can_toggle,
  onChanged,
}: Readonly<NotificationAvailabilityToggleProps>) {
  const { locale } = useLocale()
  const { toast } = useToast()
  const [enabled_state, set_enabled_state] = useState(enabled)
  const [is_saving, set_is_saving] = useState(false)

  async function toggle_availability() {
    if (!can_toggle || is_saving) {
      return
    }

    const previous_enabled = enabled_state
    const next_enabled = !enabled_state

    set_is_saving(true)
    set_enabled_state(next_enabled)

    try {
      const response = await fetch("/api/chat/concierge", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: next_enabled }),
      })

      const payload = (await response.json().catch(() => null)) as {
        enabled?: boolean
        error?: string
      } | null

      if (!response.ok || typeof payload?.enabled !== "boolean") {
        throw new Error(payload?.error ?? "concierge_toggle_failed")
      }

      set_enabled_state(payload.enabled)
      onChanged?.(payload.enabled)
      window.dispatchEvent(
        new CustomEvent("amp-concierge-availability-changed", {
          detail: { enabled: payload.enabled },
        }),
      )
      toast({
        tone: "success",
        placement: "center",
        duration_ms: 3000,
        message: payload.enabled
          ? concierge_toggle_content.on_success[locale]
          : concierge_toggle_content.off_success[locale],
      })
    } catch {
      set_enabled_state(previous_enabled)
      toast({
        tone: "error",
        placement: "center",
        duration_ms: 3000,
        message: concierge_toggle_content.error[locale],
      })
    } finally {
      set_is_saving(false)
    }
  }

  return (
    <button
      type="button"
      aria-label={enabled_state ? "Concierge ON" : "Concierge OFF"}
      aria-pressed={enabled_state}
      disabled={!can_toggle || is_saving}
      onClick={can_toggle ? toggle_availability : undefined}
      className={[
        "flex h-9 shrink-0 flex-row items-center justify-center gap-1 rounded-full border px-2 transition-colors",
        enabled_state
          ? "border-[#22c55e] bg-[#22c55e] text-white"
          : "border-[#d1d5db] bg-[#f3f4f6] text-neutral-900",
        !can_toggle ? "opacity-60" : "",
      ].join(" ")}
    >
      <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
        <MessageCircle
          className={[
            "h-4 w-4",
            enabled_state ? "text-white" : "text-neutral-400",
          ].join(" ")}
          strokeWidth={1.8}
        />
        {!enabled_state ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[1.5px] w-[18px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-neutral-600"
          />
        ) : null}
      </span>
      <span className="text-[12px] font-bold leading-none">
        {enabled_state ? "ON" : "OFF"}
      </span>
    </button>
  )
}
