import {
  isLineFlexCarouselPayload,
  isQuickMenuTriggerAction,
} from "@/core/bot/rules"

export type FlexBubbleButton = {
  label: string
  data: string
}

export type FlexBubbleView = {
  image_url: string | null
  texts: string[]
  buttons: FlexBubbleButton[]
}

function readRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function readTextNodes(contents: unknown): string[] {
  if (!Array.isArray(contents)) {
    return []
  }

  return contents
    .map((item) => {
      const record = readRecord(item)

      if (!record) {
        return null
      }

      if (record.type === "text" && typeof record.text === "string") {
        return record.text
      }

      if (Array.isArray(record.contents)) {
        return readTextNodes(record.contents)
      }

      return null
    })
    .flat()
    .filter((value): value is string => Boolean(value))
}

function readFooterButtons(footer: Record<string, unknown> | null) {
  const contents = footer?.contents

  if (!Array.isArray(contents)) {
    return []
  }

  return contents
    .map((item) => {
      const button = readRecord(item)
      const action = readRecord(button?.action)

      if (button?.type !== "button" || !action) {
        return null
      }

      const label = typeof action.label === "string" ? action.label : ""
      const data = typeof action.data === "string" ? action.data : label

      if (!label) {
        return null
      }

      return { label, data }
    })
    .filter((button): button is FlexBubbleButton => Boolean(button))
}

function readFlexBubble(bubble: Record<string, unknown>): FlexBubbleView {
  const hero = readRecord(bubble.hero)
  const body = readRecord(bubble.body)
  const footer = readRecord(bubble.footer)

  return {
    image_url: typeof hero?.url === "string" ? hero.url : null,
    texts: readTextNodes(body?.contents),
    buttons: readFooterButtons(footer),
  }
}

export function readFlexCarouselBubbles(
  payload: Record<string, unknown> | null | undefined,
): FlexBubbleView[] {
  if (!isLineFlexCarouselPayload(payload)) {
    return []
  }

  return payload.contents
    .map((bubble) => readFlexBubble(readRecord(bubble) ?? {}))
    .filter(
      (bubble) =>
        bubble.image_url ||
        bubble.texts.length > 0 ||
        bubble.buttons.length > 0,
    )
}

export { isQuickMenuTriggerAction }
