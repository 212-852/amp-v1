import type {
  OverlayAnimation,
  OverlayContext,
  OverlayItem,
  OverlayPlacement,
  OverlayRule,
  OverlayType,
} from "@/components/overlay/types"

const animationByType: Record<OverlayType, OverlayAnimation> = {
  my_page: "from_bottom",
  menu: "from_left",
  link: "center_drop",
  notice: "center_drop",
  language: "center_drop",
}

const placementByType: Record<OverlayType, OverlayPlacement> = {
  my_page: "bottom",
  menu: "left",
  link: "center",
  notice: "center",
  language: "center",
}

const contentByType: Record<
  OverlayType,
  {
    title: string
    description: string
    items: OverlayItem[]
  }
> = {
  my_page: {
    title: "My Page",
    description: "Account and profile actions.",
    items: [
      { id: "profile", title: "Profile" },
      { id: "reservations", title: "Reservations" },
      { id: "linked_identity", title: "Linked identity" },
    ],
  },
  menu: {
    title: "Menu",
    description: "Navigation and app actions.",
    items: [
      { id: "dashboard", title: "Dashboard" },
      { id: "support", title: "Support" },
      { id: "settings", title: "Settings" },
    ],
  },
  link: {
    title: "",
    description: "",
    items: [
      {
        id: "line",
        action: "line",
      },
      {
        id: "google",
        action: "google",
      },
      {
        id: "email",
        action: "email",
      },
    ],
  },
  notice: {
    title: "Notice",
    description: "Latest notifications and required actions.",
    items: [
      { id: "reservation_updates", title: "Reservation updates" },
      { id: "driver_messages", title: "Driver messages" },
      { id: "system_notices", title: "System notices" },
    ],
  },
  language: {
    title: "",
    description: "",
    items: [
      { id: "ja", locale: "ja" },
      { id: "en", locale: "en" },
      { id: "es", locale: "es" },
    ],
  },
}

export function resolveOverlayRule(context: OverlayContext): OverlayRule {
  const content = contentByType[context.type]

  return {
    type: context.type,
    source: context.source,
    animation: animationByType[context.type],
    placement: placementByType[context.type],
    ...content,
  }
}
