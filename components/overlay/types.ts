import type { Locale } from "@/src/lib/locale"

export type OverlayType =
  | "my_page"
  | "menu"
  | "link"
  | "account"
  | "language"

export type OverlaySource = "user" | "driver" | "admin"

export type OverlayRequest = {
  type: OverlayType
  source: OverlaySource
  account?: OverlayAccount
  can_start_line_oauth?: boolean
}

export type OverlayContext = OverlayRequest & {
  requestedAt: number
}

export type OverlayAnimation =
  | "from_bottom"
  | "center_drop"
  | "from_left"

export type OverlayPlacement = "bottom" | "left" | "center"

export type OverlayItem = {
  id: string
  title?: string
  description?: string
  badge?: string
  action?: "line" | "google" | "email"
  locale?: Locale
}

export type OverlayAccount = {
  user_uuid: string | null
  display_name: string | null
  image_url: string | null
  provider: "google" | "line" | "email" | null
  email: string | null
  can_logout: boolean
}

export type OverlayRule = {
  type: OverlayType
  source: OverlaySource
  title?: string
  description?: string
  animation: OverlayAnimation
  placement: OverlayPlacement
  items: OverlayItem[]
  account?: OverlayAccount
}

export type OverlayAction = {
  context: OverlayContext
  rule: OverlayRule
}

export type OverlayPhase = "opening" | "open" | "closing"
