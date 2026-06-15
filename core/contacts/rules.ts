import type {
  ContactAccessContext,
  ContactContext,
  ContactState,
  ContactType,
} from "@/core/contacts/context"
import type { SourceChannel } from "@/core/auth/types"

const contactTypes: ContactType[] = ["line", "email", "push", "discord"]
const contactChannels: SourceChannel[] = ["web", "pwa", "liff", "line"]
const contactStates: ContactState[] = ["active", "background", "hidden", "offline"]

export const CONTACT_ONLINE_WINDOW_MS = 60 * 1000

export type ContactRecord = ContactContext & {
  contact_uuid?: string
  channel: SourceChannel
  state: ContactState
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
  contact: Pick<ContactRecord, "last_seen_at" | "state"> | null,
  now: Date = new Date(),
) {
  if (!contact?.last_seen_at || contact.state !== "active") {
    return false
  }

  const lastSeen = Date.parse(contact.last_seen_at)

  return Number.isFinite(lastSeen) && now.getTime() - lastSeen <= CONTACT_ONLINE_WINDOW_MS
}

export function isRealContactDestination(context: ContactContext) {
  if (context.value.startsWith("push:visitor:")) {
    return false
  }

  return isValidContactType(context.type) &&
    Boolean(context.value)
}

export function assertContactContext(context: ContactContext) {
  if (!isValidContactType(context.type)) {
    throw new Error(`Invalid contact type: ${context.type}`)
  }

  if (!isRealContactDestination(context)) {
    throw new Error("Contact requires a real delivery destination")
  }
}

export function assertContactAccessContext(context: ContactAccessContext) {
  if (!context.user_uuid && !context.visitor_uuid) {
    throw new Error("Contact access update requires user_uuid or visitor_uuid")
  }

  if (!isValidContactChannel(context.channel)) {
    throw new Error(`Invalid contact channel: ${context.channel}`)
  }

  if (!isValidContactState(context.state)) {
    throw new Error(`Invalid contact state: ${context.state}`)
  }
}
