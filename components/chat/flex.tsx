"use client"

import { useOverlay } from "@/components/overlay"
import type { ChatMessagePayload } from "@/core/chat/types"
import {
  read_web_carousel_payload,
  resolve_web_flex_action,
  resolve_web_flex_button_style,
  resolve_web_flex_hero_class_name,
  type WebFlexAction,
} from "@/core/output/web"

type FlexRecord = Record<string, unknown>

function readRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as FlexRecord
}

function readContents(value: unknown) {
  return Array.isArray(value) ? value : []
}

function readText(value: unknown) {
  return typeof value === "string" ? value : ""
}

function readSize(value: unknown) {
  if (value === "xs") {
    return "12px"
  }

  if (value === "sm") {
    return "13px"
  }

  if (value === "lg") {
    return "18px"
  }

  if (value === "xl") {
    return "20px"
  }

  return "15px"
}

function readWeight(value: unknown) {
  return value === "bold" ? 700 : 400
}

function readPadding(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  if (value.endsWith("px") || value.endsWith("%")) {
    return value
  }

  if (value === "none") {
    return "0"
  }

  if (value === "xs") {
    return "4px"
  }

  if (value === "sm") {
    return "8px"
  }

  if (value === "md") {
    return "12px"
  }

  if (value === "lg") {
    return "16px"
  }

  if (value === "xl") {
    return "20px"
  }

  if (value === "xxl") {
    return "24px"
  }

  return value
}

function readGap(value: unknown) {
  if (value === "xs") {
    return "4px"
  }

  if (value === "sm") {
    return "12px"
  }

  if (value === "md") {
    return "14px"
  }

  if (value === "lg") {
    return "18px"
  }

  return "10px"
}

function readAlignItems(value: unknown) {
  if (value === "center") {
    return "center"
  }

  if (value === "flex-end" || value === "end") {
    return "flex-end"
  }

  return "flex-start"
}

function readBoxPadding(node: FlexRecord) {
  const all = readPadding(node.paddingAll, "")

  return {
    paddingTop: readPadding(node.paddingTop, all || "0"),
    paddingRight: readPadding(node.paddingRight, all || "0"),
    paddingBottom: readPadding(node.paddingBottom, all || "0"),
    paddingLeft: readPadding(node.paddingLeft, all || "0"),
  }
}

function readAlign(value: unknown) {
  return value === "center" ? "center" : "start"
}

function readCarouselPayload(payload: ChatMessagePayload | null) {
  return read_web_carousel_payload(payload as Record<string, unknown> | null)
}

async function requestQuickMenu() {
  await fetch("/api/chat/room", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trigger: "quick_menu_requested" }),
  }).catch(() => null)

  window.dispatchEvent(new CustomEvent("amp-chat-message-created"))
}

function FlexHero({ node }: Readonly<{ node: FlexRecord }>) {
  const url = readText(node.url)

  if (!url || node.type !== "image") {
    return null
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={[
        "chat_card_image",
        resolve_web_flex_hero_class_name(node),
      ].join(" ")}
    />
  )
}

function FlexText({ node }: Readonly<{ node: FlexRecord }>) {
  const text = readText(node.text)

  if (!text) {
    return null
  }

  return (
    <div
      className={[
        "m-0 block w-full",
        node.wrap === true ? "whitespace-pre-wrap break-words" : "break-words",
      ].join(" ")}
      style={{
        color: readText(node.color) || "#3D2A19",
        fontSize: readSize(node.size),
        fontWeight: readWeight(node.weight),
        lineHeight: 1.45,
      }}
    >
      {text}
    </div>
  )
}

function FlexSeparator({ node }: Readonly<{ node?: FlexRecord | null }>) {
  const margin = readText(node?.margin)

  return (
    <div
      className={[
        "h-px w-full bg-[#eadfce]",
        margin === "md" ? "my-3" : margin === "sm" ? "my-2" : "",
      ].join(" ")}
    />
  )
}

const FLEX_ACTION_BUTTON_CLASS =
        "chat_card_button flex h-[44px] items-center justify-center px-4 text-[14px] font-semibold"

function readCornerRadius(value: unknown) {
  return typeof value === "string" ? value : "16px"
}

function readFlexActionColors(node: FlexRecord) {
  const line_primary_style = resolve_web_flex_button_style(node)

  if (line_primary_style) {
    return line_primary_style
  }

  if (node.style === "secondary") {
    return {
      backgroundColor: "#F4E8D8",
      color: "#3D2A19",
      border: "none",
    }
  }

  return {
    backgroundColor: "#8F5D28",
    color: "#FFFFFF",
    border: "none",
  }
}

function FlexButton({
  node,
  onAction,
}: Readonly<{
  node: FlexRecord
  onAction: (action: WebFlexAction) => void
}>) {
  const action = readRecord(node.action)
  const label = readText(action?.label)
  const resolved_action = resolve_web_flex_action(action)
  const is_link = node.style === "link"
  const is_centered = readAlign(node.align) === "center"

  if (!label) {
    return null
  }

  if (is_link) {
    return (
      <button
        type="button"
        onClick={() => onAction(resolved_action)}
        className={[
          "bg-transparent px-1 py-0.5 text-[13px] font-medium underline decoration-[#007AFF]/50 underline-offset-2",
          is_centered ? "w-auto text-center" : "w-full text-left",
        ].join(" ")}
        style={{ color: readText(node.color) || "#007AFF" }}
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onAction(resolved_action)}
      className={FLEX_ACTION_BUTTON_CLASS}
      style={{
        borderRadius: readCornerRadius(node.cornerRadius),
        ...readFlexActionColors(node),
      }}
    >
      {label}
    </button>
  )
}

function FlexBox({
  node,
  onAction,
}: Readonly<{
  node: FlexRecord
  onAction: (action: WebFlexAction) => void
}>) {
  const is_horizontal = node.layout === "horizontal"
  const padding = readBoxPadding(node)
  const align_items = readAlignItems(node.alignItems)

  return (
    <div
      className={[
        "box-border flex w-full",
        is_horizontal ? "flex-row" : "flex-col",
        align_items === "center" ? "items-center text-center" : "items-stretch",
      ].join(" ")}
      style={{
        gap: readGap(node.spacing),
        paddingTop: padding.paddingTop,
        paddingRight: padding.paddingRight,
        paddingBottom: padding.paddingBottom,
        paddingLeft: padding.paddingLeft,
      }}
    >
      {readContents(node.contents).map((child, index) => (
        <FlexNode
          key={index}
          node={readRecord(child)}
          onAction={onAction}
        />
      ))}
    </div>
  )
}

function FlexBubbleSection({
  node,
  onAction,
  kind,
}: Readonly<{
  node: FlexRecord
  onAction: (action: WebFlexAction) => void
  kind: "header" | "body" | "footer"
}>) {
  return (
    <section
      className={[
        "relative z-[1] w-full bg-white",
        kind === "body" ? "chat_card_body" : "",
        kind === "body" ? "flex-1" : "",
        kind === "footer" ? "mt-auto" : "",
      ].join(" ")}
    >
      <FlexBox node={node} onAction={onAction} />
    </section>
  )
}

function FlexNode({
  node,
  onAction,
}: Readonly<{
  node: FlexRecord | null
  onAction: (action: WebFlexAction) => void
}>) {
  if (!node) {
    return null
  }

  if (node.type === "box") {
    return <FlexBox node={node} onAction={onAction} />
  }

  if (node.type === "text") {
    return <FlexText node={node} />
  }

  if (node.type === "separator") {
    return <FlexSeparator node={node} />
  }

  if (node.type === "button") {
    return <FlexButton node={node} onAction={onAction} />
  }

  if (node.type === "image") {
    return <FlexHero node={node} />
  }

  return null
}

function FlexBubble({
  bubble,
  onAction,
}: Readonly<{
  bubble: FlexRecord
  onAction: (action: WebFlexAction) => void
}>) {
  if (bubble.type !== "bubble") {
    return null
  }

  const header = readRecord(bubble.header)
  const hero = readRecord(bubble.hero)
  const body = readRecord(bubble.body)
  const footer = readRecord(bubble.footer)

  return (
    <article className="chat_card flex h-auto max-h-none shrink-0 snap-start self-stretch flex-col overflow-hidden rounded-[18px] bg-white">
      {header ? (
        <FlexBubbleSection
          node={header}
          onAction={onAction}
          kind="header"
        />
      ) : null}
      {hero ? (
        <div className="relative z-0 w-full">
          <FlexHero node={hero} />
        </div>
      ) : null}
      {body ? (
        <FlexBubbleSection node={body} onAction={onAction} kind="body" />
      ) : null}
      {footer ? (
        <FlexBubbleSection
          node={footer}
          onAction={onAction}
          kind="footer"
        />
      ) : null}
    </article>
  )
}

export default function FlexMessage({
  payload,
}: Readonly<{
  payload: ChatMessagePayload | null
}>) {
  const { openOverlay } = useOverlay()
  const carousel = readCarouselPayload(payload)

  if (!carousel?.contents) {
    return null
  }

  function handleAction(action: WebFlexAction) {
    if (action.kind === "quick_menu") {
      void requestQuickMenu()
      return
    }

    if (action.kind === "uri" && action.value) {
      window.location.href = action.value
      return
    }

    if (action.kind === "menu" && action.value) {
      openOverlay({ type: "menu", source: "user" })
    }
  }

  return (
    <div className="chat_card h-auto max-h-none w-full min-w-0 overflow-x-auto overflow-y-visible overscroll-x-contain pb-0 pt-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max snap-x snap-mandatory items-stretch gap-3">
        {carousel.contents.map((bubble, index) => (
          <FlexBubble
            key={index}
            bubble={readRecord(bubble) ?? {}}
            onAction={handleAction}
          />
        ))}
      </div>
    </div>
  )
}
