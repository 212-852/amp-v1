"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type {
  DriverChecklistItem,
  DriverOnboardingTaskKey,
} from "@/core/driver/context"

type DriverPreparationContextValue = {
  items: DriverChecklistItem[]
  all_complete: boolean
  can_operate: boolean
  get_item: (key: DriverOnboardingTaskKey) => DriverChecklistItem | null
  replace_items: (items: DriverChecklistItem[]) => void
  update_item: (
    key: DriverOnboardingTaskKey,
    patch: Partial<DriverChecklistItem>,
  ) => void
}

const DriverPreparationContext =
  createContext<DriverPreparationContextValue | null>(null)

export function DriverPreparationProvider({
  initial_items,
  initial_all_complete,
  can_operate,
  children,
}: Readonly<{
  initial_items: DriverChecklistItem[]
  initial_all_complete: boolean
  can_operate: boolean
  children: ReactNode
}>) {
  const [items, setItems] = useState(initial_items)

  const replace_items = useCallback((next_items: DriverChecklistItem[]) => {
    setItems(next_items)
  }, [])

  const update_item = useCallback(
    (key: DriverOnboardingTaskKey, patch: Partial<DriverChecklistItem>) => {
      setItems((current) =>
        current.map((item) =>
          item.key === key
            ? {
                ...item,
                ...patch,
              }
            : item,
        ),
      )
    },
    [],
  )

  const get_item = useCallback(
    (key: DriverOnboardingTaskKey) =>
      items.find((item) => item.key === key) ?? null,
    [items],
  )

  const all_complete = useMemo(
    () => items.length > 0 && items.every((item) => item.complete),
    [items],
  )

  const value = useMemo(
    () => ({
      items,
      all_complete,
      can_operate,
      get_item,
      replace_items,
      update_item,
    }),
    [all_complete, can_operate, get_item, items, replace_items, update_item],
  )

  return (
    <DriverPreparationContext.Provider value={value}>
      {children}
    </DriverPreparationContext.Provider>
  )
}

export function use_driver_preparation_optional() {
  return useContext(DriverPreparationContext)
}

export function use_driver_preparation() {
  const context = useContext(DriverPreparationContext)

  if (!context) {
    throw new Error("use_driver_preparation must be used within DriverPreparationProvider")
  }

  return context
}
