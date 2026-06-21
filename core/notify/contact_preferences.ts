import type { Session } from "@/core/auth/types"
import type { NotificationType } from "@/core/chat/types"
import { getRestConfig, restHeaders, restUrl } from "@/core/db/rest"

export type NotificationContactRow = {
  contact_uuid?: string | null
  type?: string | null
  value?: string | null
  endpoint?: string | null
  p256dh?: string | null
  auth?: string | null
  channel?: string | null
  state?: string | null
  receive?: boolean | null
  updated_at?: string | null
}

function identityFilter(session: Pick<Session, "user_uuid" | "visitor_uuid">) {
  if (session.user_uuid) {
    return `user_uuid=eq.${encodeURIComponent(session.user_uuid)}`
  }

  if (session.visitor_uuid) {
    return `visitor_uuid=eq.${encodeURIComponent(session.visitor_uuid)}`
  }

  return null
}

export async function loadIdentityNotificationContacts(
  session: Pick<Session, "user_uuid" | "visitor_uuid">,
): Promise<NotificationContactRow[]> {
  const config = getRestConfig()
  const filter = identityFilter(session)

  if (!config || !filter) {
    return []
  }

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      [
        filter,
        "select=contact_uuid,type,value,endpoint,p256dh,auth,channel,state,receive,updated_at",
        "order=updated_at.desc",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return []
  }

  return (await response.json()) as NotificationContactRow[]
}

export async function loadIdentityNotificationContact(
  session: Pick<Session, "user_uuid" | "visitor_uuid">,
): Promise<NotificationContactRow | null> {
  const config = getRestConfig()
  const filter = identityFilter(session)

  if (!config || !filter) {
    return null
  }

  const response = await fetch(
    restUrl(
      config,
      "contacts",
      [
        filter,
        "select=contact_uuid,type,value,endpoint,p256dh,auth,channel,state,receive,updated_at",
        "order=updated_at.desc",
        "limit=1",
      ].join("&"),
    ),
    {
      headers: restHeaders(config),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    return null
  }

  const rows = (await response.json()) as NotificationContactRow[]
  return rows[0] ?? null
}

export function resolveNotificationTypeFromContacts(
  contacts: NotificationContactRow[],
): NotificationType {
  const receiving = contacts.filter((contact) => contact.receive === true)

  if (receiving.some((contact) => contact.type === "push")) {
    return "pwa_push"
  }

  if (receiving.some((contact) => contact.type === "line")) {
    return "line"
  }

  if (contacts.some((contact) => contact.type === "push")) {
    return "pwa_push"
  }

  if (contacts.some((contact) => contact.type === "line")) {
    return "line"
  }

  return "line"
}
