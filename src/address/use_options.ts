"use client"

import { useEffect, useState } from "react"

import { ADDRESS_OPTIONS } from "@/src/address/options"
import type { AddressOptions } from "@/src/address/rules"

export function useAddressOptions(input?: {
  prefecture_code?: string | null
  city_code?: string | null
}) {
  const [address_options, set_address_options] = useState<AddressOptions>(
    ADDRESS_OPTIONS,
  )
  const [is_loading, set_is_loading] = useState(false)
  const [error_message, set_error_message] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load_address_options() {
      try {
        const search = new URLSearchParams()

        if (input?.prefecture_code) {
          search.set("prefecture_code", input.prefecture_code)
        }

        if (input?.city_code) {
          search.set("city_code", input.city_code)
        }

        const query = search.toString()
        const response = await fetch(
          `/api/address${query ? `?${query}` : ""}`,
          { cache: "no-store" },
        )

        if (!response.ok) {
          const message = "Address options request failed"
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
          set_error_message(message)
          return
        }

        if (payload.prefectures.length === 0) {
          const message = "No prefecture options returned"
          set_error_message(message)
          return
        }

        set_address_options(payload)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
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
  }, [input?.city_code, input?.prefecture_code])

  return {
    options: address_options,
    is_loading,
    is_ready: address_options.prefectures.length > 0,
    error_message,
  }
}
