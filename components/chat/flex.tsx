"use client"

import Image from "next/image"

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
    return "8px"
  }

  if (value === "md") {
    return "12px"
  }

  return "10px"
}

function readAspectRatio(value: unknown) {
  const ratio = readText(value)
  const [width, height] = ratio.split(":").map(Number)

  if (width > 0 && height > 0) {
    return `${width} / ${height}`
  }

  return "20 / 13"
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
    <div
      className="relative w-full overflow-hidden bg-[#f3e7d7]"
      style={{ aspectRatio: readAspectRatio(node.aspectRatio) }}
    >
      <Image
        src={url}
        alt=""
        fill
        className={
          node.aspectMode === "contain" ? "object-contain" : "object-cover"
        }
        sizes="320px"
      />
    </div>
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

function FlexSeparator() {
  return <div className="h-px w-full bg-[#eadfce]" />
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

  if (!label) {
    return null
  }

  if (is_link) {
    return (
      <button
        type="button"
        onClick={() => onAction(data)}
        className="w-full py-1 text-left text-[13px] font-semibold underline decoration-[#8F5D28]/40 underline-offset-2"
        style={{ color: readText(node.color) || "#8F5D28" }}
      >
        {label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onAction(data)}
      className="min-h-[40px] w-full px-3 text-[14px] font-semibold"
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

  return (
    <div
      className={[
        "flex",
        is_horizontal ? "flex-row items-center" : "flex-col",
      ].join(" ")}
      style={{
        gap: readGap(node.spacing),
        padding: readPadding(node.paddingAll, "0"),
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
    return <FlexSeparator />
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
    <article className="h-auto w-[300px] max-w-[calc(100vw-76px)] shrink-0 snap-start overflow-visible rounded-[14px] bg-white">
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
    <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
