import type { Locale } from "@/src/lib/locale"

export type OverlayType =
  | "my_page"
  | "menu"
  | "link"
  | "notice"
  | "language"

export type OverlaySource = "user" | "driver" | "admin"

export type OverlayRequest = {
  type: OverlayType
  source: OverlaySource
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

export type OverlayRule = {
  type: OverlayType
  source: OverlaySource
  title?: string
  description?: string
  animation: OverlayAnimation
  placement: OverlayPlacement
  items: OverlayItem[]
}

export type OverlayAction = {
  context: OverlayContext
  rule: OverlayRule
}

export type OverlayPhase = "opening" | "open" | "closing"
