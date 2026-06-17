"use client"

import { useCallback, useContext } from "react"

import { ToastContext } from "@/components/ui/toast_provider"

export type ToastTone = "success" | "error" | "info" | "warning"

export type ToastInput = {
  message: string
  tone?: ToastTone
  duration_ms?: number
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
