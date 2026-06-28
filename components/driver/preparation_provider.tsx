"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { DriverChecklistItem, DriverOnboardingTaskKey } from "@/core/driver/context"

type DriverPreparationContextValue = {
  items: DriverChecklistItem[]
  all_complete: boolean
  can_operate: boolean
  get_item: (key: DriverOnboardingTaskKey) => DriverChecklistItem | null
  update_item: (key: DriverOnboardingTaskKey, patch: Partial<DriverChecklistItem>) => void
}

const DriverPreparationContext = createContext<DriverPreparationContextValue | null>(null)

export function DriverPreparationProvider({
  initial_items,
  can_operate,
  children,
}: Readonly<{
  initial_items: DriverChecklistItem[]
  initial_all_complete: boolean
  can_operate: boolean
  children: ReactNode
}>) {
  const [items, set_items] = useState(initial_items)

  const update_item = useCallback((
    key: DriverOnboardingTaskKey,
    patch: Partial<DriverChecklistItem>,
  ) => {
    set_items((current) => current.map((item) =>
      item.key === key ? { ...item, ...patch } : item,
    ))
  }, [])

  const get_item = useCallback((key: DriverOnboardingTaskKey) =>
    items.find((item) => item.key === key) ?? null, [items])

  const all_complete = useMemo(
    () => items.length === 4 && items.every((item) => item.complete),
    [items],
  )

  const value = useMemo(() => ({
    items,
    all_complete,
    can_operate,
    get_item,
    update_item,
  }), [all_complete, can_operate, get_item, items, update_item])

  return (
    <DriverPreparationContext.Provider value={value}>
      {children}
    </DriverPreparationContext.Provider>
  )
}

export function useDriverPreparationOptional() {
  return useContext(DriverPreparationContext)
}

export function useDriverPreparation() {
  const context = useContext(DriverPreparationContext)
  if (!context) throw new Error("useDriverPreparation requires DriverPreparationProvider")
  return context
}
