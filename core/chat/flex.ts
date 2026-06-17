import {
  isCarouselPayload,
  resolveCarouselCardsForLocale,
  type BotCarouselCardView,
} from "@/core/bot/rules"
import type { ChatLocale, ChatMessagePayload } from "@/core/chat/types"

export type FlexCarouselCardView = BotCarouselCardView

export function readFlexCarouselCards(
  payload: ChatMessagePayload | Record<string, unknown> | null | undefined,
  locale: ChatLocale,
): FlexCarouselCardView[] {
  if (!isCarouselPayload(payload)) {
    return []
  }

  return resolveCarouselCardsForLocale(payload, locale)
}

export { isQuickMenuTriggerAction } from "@/core/bot/rules"
