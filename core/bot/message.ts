import {
  buildCarouselPayload,
  resolveBotCarouselCards,
  resolveBotLocale,
  resolveBotMessageBody,
  type BotMessageTrigger,
} from "@/core/bot/rules"
import type { ChatLocale, ChatMessageType } from "@/core/chat/types"

export type BotMessageBundle = {
  trigger: BotMessageTrigger
  type: ChatMessageType
  body: string
  payload: ReturnType<typeof buildCarouselPayload>
}

export function createBotMessageBundle(input: {
  trigger: BotMessageTrigger
  locale: ChatLocale | string | null | undefined
}): BotMessageBundle {
  const locale = resolveBotLocale(input.locale)
  const cards = resolveBotCarouselCards(input.trigger)

  return {
    trigger: input.trigger,
    type: "flex",
    body: resolveBotMessageBody(input.trigger, locale),
    payload: buildCarouselPayload({
      trigger: input.trigger,
      cards,
    }),
  }
}
