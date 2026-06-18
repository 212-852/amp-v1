import { resolveOutputLocale } from "@/core/chat/context"
import {
  buildBotCarouselPayload,
  resolveBotMessageBody,
  type BotMessageTrigger,
} from "@/core/bot/rules"
import type { ChatMessageType } from "@/core/chat/types"

export type BotMessageBundle = {
  trigger: BotMessageTrigger
  type: ChatMessageType
  body: string
  payload: ReturnType<typeof buildBotCarouselPayload>
}

export function createBotMessageBundle(input: {
  trigger: BotMessageTrigger
  locale: string | null | undefined
}): BotMessageBundle {
  const locale = resolveOutputLocale({ preferred: input.locale })

  return {
    trigger: input.trigger,
    type: "flex",
    body: resolveBotMessageBody(input.trigger),
    payload: buildBotCarouselPayload({
      trigger: input.trigger,
      locale,
    }),
  }
}
