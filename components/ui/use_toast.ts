"use client"

import type { RefObject } from "react"
import { useCallback, useContext } from "react"

import { ToastContext } from "@/components/ui/toast_provider"

export type ToastTone = "success" | "error" | "info" | "warning"

export type ToastPlacement = "default" | "anchor"

export type ToastInput = {
  message: string
  tone?: ToastTone
  duration_ms?: number
  placement?: ToastPlacement
  anchor_ref?: RefObject<HTMLElement | null>
  compact?: boolean
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }

  const toast = useCallback(
    (input: ToastInput) => {
      context.showToast(input)
    },
    [context],
  )

  return { toast }
}
