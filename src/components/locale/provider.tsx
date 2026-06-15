"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react"

import {
  default_locale,
  get_browser_locale,
  get_stored_locale,
  save_locale,
  type Locale,
} from "@/src/lib/locale"

type LocaleController = {
  locale: Locale
  set_locale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleController | null>(null)

let current_locale: Locale = default_locale
const listeners = new Set<() => void>()

function subscribe_locale(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

function get_locale_snapshot() {
  return current_locale
}

function get_server_locale_snapshot() {
  return default_locale
}

function set_locale_value(locale: Locale, persist: boolean) {
  if (current_locale === locale) {
    if (persist) {
      save_locale(locale)
    }

    return
  }

  current_locale = locale

  if (persist) {
    save_locale(locale)
  }

  listeners.forEach((listener) => listener())
}

function resolve_client_locale() {
  return get_stored_locale() ?? get_browser_locale() ?? default_locale
}

export function LocaleProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = useSyncExternalStore(
    subscribe_locale,
    get_locale_snapshot,
    get_server_locale_snapshot,
  )

  useEffect(() => {
    set_locale_value(resolve_client_locale(), false)
  }, [])

  const set_locale = useCallback((next_locale: Locale) => {
    set_locale_value(next_locale, true)
  }, [])

  const value = useMemo(
    () => ({
      locale,
      set_locale,
    }),
    [locale, set_locale],
  )

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)

  if (!context) {
    throw new Error("useLocale must be used inside LocaleProvider")
  }

  return context
}
