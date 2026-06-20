"use client"

import { useEffect, useState } from "react"

import type { AddressOptions } from "@/src/address/rules"

const EMPTY_ADDRESS_OPTIONS: AddressOptions = {
  prefectures: [],
  cities_by_prefecture: {},
}

export function useAddressOptions() {
  const [address_options, set_address_options] = useState<AddressOptions>(
    EMPTY_ADDRESS_OPTIONS,
  )
  const [is_loading, set_is_loading] = useState(true)
  const [error_message, set_error_message] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load_address_options() {
      try {
        const response = await fetch("/api/address", { cache: "no-store" })

        if (!response.ok) {
          const message = "Address options request failed"
          console.error("address_options_load_failed", {
            status: response.status,
            error_message: message,
          })
          set_error_message(message)
          return
        }

        const payload = (await response.json().catch(() => null)) as
          | AddressOptions
          | null

        if (cancelled) {
          return
        }

        if (!payload?.prefectures || !payload.cities_by_prefecture) {
          const message = "Invalid address options response"
          console.error("address_options_load_failed", {
            error_message: message,
          })
          set_error_message(message)
          return
        }

        if (payload.prefectures.length === 0) {
          const message = "No prefecture options returned"
          console.error("address_options_load_failed", {
            error_message: message,
          })
          set_error_message(message)
          return
        }

        set_address_options(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error("address_options_load_failed", {
          error_message: message,
        })
        set_error_message(message)
      } finally {
        if (!cancelled) {
          set_is_loading(false)
        }
      }
    }

    void load_address_options()

    return () => {
      cancelled = true
    }
  }, [])

  return {
    options: address_options,
    is_loading,
    is_ready: address_options.prefectures.length > 0,
    error_message,
  }
}
