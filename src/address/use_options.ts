"use client"

import { useEffect, useState } from "react"

import { ADDRESS_OPTIONS_DATA } from "@/src/address/data"
import type { AddressOptions } from "@/src/address/rules"

export function useAddressOptions(enabled: boolean) {
  const [address_options, set_address_options] = useState<AddressOptions>(
    ADDRESS_OPTIONS_DATA,
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false

    async function load_address_options() {
      try {
        const response = await fetch("/api/address", { cache: "no-store" })

        if (!response.ok) {
          console.error("address_options_load_failed", {
            status: response.status,
            error_message: "Address options request failed",
          })
          return
        }

        const payload = (await response.json().catch(() => null)) as
          | AddressOptions
          | null

        if (cancelled) {
          return
        }

        if (!payload?.prefectures || !payload.cities_by_prefecture) {
          console.error("address_options_load_failed", {
            error_message: "Invalid address options response",
          })
          return
        }

        if (payload.prefectures.length === 0) {
          console.error("address_options_load_failed", {
            error_message: "No prefecture options returned",
          })
          return
        }

        set_address_options(payload)
      } catch (error) {
        console.error("address_options_load_failed", {
          error_message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    void load_address_options()

    return () => {
      cancelled = true
    }
  }, [enabled])

  return address_options
}
