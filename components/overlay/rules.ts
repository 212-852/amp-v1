import type {
  OverlayAnimation,
  OverlayContext,
  OverlayPlacement,
  OverlayRule,
  OverlayType,
} from "@/components/overlay/types"

const animationByType: Record<OverlayType, OverlayAnimation> = {
  my_page: "from_bottom",
  menu: "from_left",
  link: "from_top",
  notice: "from_top",
  language: "from_top",
}

const placementByType: Record<OverlayType, OverlayPlacement> = {
  my_page: "bottom",
  menu: "left",
  link: "top",
  notice: "top",
  language: "top",
}

const contentByType: Record<
  OverlayType,
  {
    title: string
    description: string
    items: string[]
  }
> = {
  my_page: {
    title: "My Page",
    description: "Account and profile actions.",
    items: ["Profile", "Reservations", "Linked identity"],
  },
  menu: {
    title: "Menu",
    description: "Navigation and app actions.",
    items: ["Dashboard", "Support", "Settings"],
  },
  link: {
    title: "Link",
    description: "Connect or review linked identity.",
    items: ["LINE", "Member account", "Partner access"],
  },
  notice: {
    title: "Notice",
    description: "Latest notifications and required actions.",
    items: ["Reservation updates", "Driver messages", "System notices"],
  },
  language: {
    title: "Language",
    description: "Choose display language.",
    items: ["日本語", "English", "中文"],
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
