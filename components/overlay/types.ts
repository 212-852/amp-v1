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
  | "from_top"
  | "from_left"

export type OverlayPlacement = "bottom" | "left" | "top"

export type OverlayRule = {
  type: OverlayType
  source: OverlaySource
  title: string
  description: string
  animation: OverlayAnimation
  placement: OverlayPlacement
  items: string[]
}

export type OverlayAction = {
  context: OverlayContext
  rule: OverlayRule
}

export type OverlayPhase = "opening" | "open" | "closing"
