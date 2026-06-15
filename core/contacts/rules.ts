import type { SourceChannel } from "@/core/auth/types"
import type { ContactContext, ContactState, ContactType } from "@/core/contacts/context"

export const CONTACT_ONLINE_WINDOW_MS = 60 * 1000

const contactTypes: ContactType[] = ["line", "email", "push", "discord"]
const contactChannels: SourceChannel[] = ["web", "pwa", "liff", "line"]
const contactStates: ContactState[] = ["active", "background", "hidden", "offline"]

export type ContactRecord = ContactContext & {
  contact_uuid?: string
  receive: boolean
  last_seen_at: string | null
}

export function isValidContactType(type: string): type is ContactType {
  return contactTypes.includes(type as ContactType)
}

export function isValidContactChannel(channel: string): channel is SourceChannel {
  return contactChannels.includes(channel as SourceChannel)
}

export function isValidContactState(state: string): state is ContactState {
  return contactStates.includes(state as ContactState)
}

export function isContactOnline(
  last_seen_at: string | null,
  now: Date = new Date(),
) {
  if (!last_seen_at) {
    return false
  }

  const lastSeen = Date.parse(last_seen_at)

  return Number.isFinite(lastSeen) && now.getTime() - lastSeen <= CONTACT_ONLINE_WINDOW_MS
}

export function resolveContactReceive(context: ContactContext) {
  return isValidContactType(context.type) &&
    isValidContactChannel(context.channel) &&
    isValidContactState(context.state) &&
    Boolean(context.value)
}

export function assertContactContext(context: ContactContext) {
  if (!isValidContactType(context.type)) {
    throw new Error(`Invalid contact type: ${context.type}`)
  }

  if (!isValidContactChannel(context.channel)) {
    throw new Error(`Invalid contact channel: ${context.channel}`)
  }

  if (!isValidContactState(context.state)) {
    throw new Error(`Invalid contact state: ${context.state}`)
  }

  if (!context.user_uuid && !context.visitor_uuid) {
    throw new Error("Contact requires user_uuid or visitor_uuid")
  }
}
