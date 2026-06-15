import type { ContactContext, ContactType } from "@/core/contacts/context"

const contactTypes: ContactType[] = ["line", "email", "push", "discord"]

export type ContactRecord = ContactContext & {
  contact_uuid?: string
}

export function isValidContactType(type: string): type is ContactType {
  return contactTypes.includes(type as ContactType)
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
