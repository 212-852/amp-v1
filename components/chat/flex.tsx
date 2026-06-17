"use client"

import { useOverlay } from "@/components/overlay"
import { isQuickMenuTriggerAction } from "@/core/bot/rules"
import type { ChatMessagePayload } from "@/core/chat/types"

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
  return typeof value === "string" ? value : fallback
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
      className="block h-auto w-full rounded-t-[18px] object-cover"
    />
  )
}

function FlexText({ node }: Readonly<{ node: FlexRecord }>) {
  const text = readText(node.text)

  if (!text) {
    return null
  }

  return (
    <p
      className={node.wrap === true ? "whitespace-pre-wrap" : ""}
      style={{
        color: readText(node.color) || "#3D2A19",
        fontSize: readSize(node.size),
        fontWeight: readWeight(node.weight),
        lineHeight: 1.45,
      }}
    >
      {text}
    </p>
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

function readCornerRadius(value: unknown) {
  return typeof value === "string" ? value : "4px"
}

function FlexButton({
  node,
  onAction,
}: Readonly<{
  node: FlexRecord
  onAction: (action: string) => void
}>) {
  const action = readRecord(node.action)
  const label = readText(action?.label)
  const data = readText(action?.data) || label
  const is_link = node.style === "link"
  const is_centered = readAlign(node.align) === "center"

  if (!label) {
    return null
  }

  if (is_link) {
    return (
      <button
        type="button"
        onClick={() => onAction(data)}
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
      onClick={() => onAction(data)}
      className="min-h-[44px] w-full px-3 text-[14px] font-semibold"
      style={{
        borderRadius: readCornerRadius(node.cornerRadius),
        backgroundColor:
          node.style === "secondary"
            ? "#F4E8D8"
            : readText(node.color) || "#8F5D28",
        color: node.style === "secondary" ? "#3D2A19" : "#FFFFFF",
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
  onAction: (action: string) => void
}>) {
  const is_horizontal = node.layout === "horizontal"
  const padding = readBoxPadding(node)
  const align_items = readAlignItems(node.alignItems)

  return (
    <div
      className={[
        "flex",
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

function FlexNode({
  node,
  onAction,
}: Readonly<{
  node: FlexRecord | null
  onAction: (action: string) => void
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
  onAction: (action: string) => void
}>) {
  if (bubble.type !== "bubble") {
    return null
  }

  const hero = readRecord(bubble.hero)
  const body = readRecord(bubble.body)
  const footer = readRecord(bubble.footer)

  return (
    <article className="h-auto max-h-none w-[300px] max-w-[calc(100vw-76px)] shrink-0 snap-start overflow-hidden rounded-[18px] bg-white">
      {hero ? <FlexHero node={hero} /> : null}
      {body ? <FlexBox node={body} onAction={onAction} /> : null}
      {footer ? <FlexBox node={footer} onAction={onAction} /> : null}
    </article>
  )
}

export default function FlexMessage({
  payload,
}: Readonly<{
  payload: ChatMessagePayload | null
}>) {
  const { openOverlay } = useOverlay()

  if (payload?.type !== "carousel" || !Array.isArray(payload.contents)) {
    return null
  }

  function handleAction(action: string) {
    if (isQuickMenuTriggerAction(action)) {
      void requestQuickMenu()
      return
    }

    if (action) {
      openOverlay({ type: "menu", source: "user" })
    }
  }

  return (
    <div className="h-auto max-h-none w-full min-w-0 overflow-x-auto overflow-y-visible overscroll-x-contain pb-0 pt-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max snap-x snap-mandatory gap-2">
        {payload.contents.map((bubble, index) => (
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
