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
  | "from_bottom_compact"
  | "from_left"

export type OverlayRule = {
  type: OverlayType
  source: OverlaySource
  title: string
  description: string
  animation: OverlayAnimation
  items: string[]
}

export type OverlayAction = {
  context: OverlayContext
  rule: OverlayRule
}

export type OverlayPhase = "opening" | "open" | "closing"
