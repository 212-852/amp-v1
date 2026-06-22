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
  account: "center_drop",
  language: "center_drop",
}

const placementByType: Record<OverlayType, OverlayPlacement> = {
  my_page: "bottom",
  menu: "left",
  link: "center",
  account: "center",
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
    title: "",
    description: "",
    items: [
      { id: "profile" },
      { id: "reservations" },
      { id: "linked_identity" },
    ],
  },
  menu: {
    title: "",
    description: "",
    items: [
      { id: "dashboard" },
      { id: "support" },
      { id: "driver_recruitment", href: "/募集" },
      { id: "settings" },
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
  account: {
    title: "",
    description: "",
    items: [],
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
  const items =
    context.type === "link" && context.can_start_line_oauth === false
      ? content.items.filter((item) => item.action !== "line")
      : content.items

  return {
    type: context.type,
    source: context.source,
    animation: animationByType[context.type],
    placement: placementByType[context.type],
    account: context.account,
    ...content,
    items,
  }
}
