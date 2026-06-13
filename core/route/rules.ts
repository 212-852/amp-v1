import { getIdentityLinkState } from "@/core/auth/identity"
import { isLinkedIdentity } from "@/core/auth/link"
import { getAuthSession } from "@/core/auth/session"
import { resolveEntranceContext } from "@/core/entrance/context"

export type AmpRouteKey =
  | "app-top"
  | "driver-top"
  | "admin-top"
  | "corporate-top"
  | "airport-top"
  | "tokyo-top"

export type AmpRouteResult = {
  key: AmpRouteKey
  path: string
  title: string
}

export async function resolveAmpRoute(): Promise<AmpRouteResult> {
  const entrance = await resolveEntranceContext()
  const session = await getAuthSession(entrance)
  const identity = await getIdentityLinkState(entrance, session)
  const linked = isLinkedIdentity(identity)

  if (entrance.type === "corporate") {
    return {
      key: "corporate-top",
      path: "/corporate",
      title: "Corporate Top",
    }
  }

  if (entrance.type === "airport") {
    return {
      key: "airport-top",
      path: "/airport",
      title: "Airport Top",
    }
  }

  if (entrance.type === "tokyo") {
    return {
      key: "tokyo-top",
      path: "/tokyo",
      title: "Tokyo Top",
    }
  }

  if (session.role === "admin") {
    return {
      key: "admin-top",
      path: "/admin",
      title: "Admin Top",
    }
  }

  if (session.role === "driver") {
    return {
      key: "driver-top",
      path: "/driver",
      title: "Driver Top",
    }
  }

  if (session.role === "member" && linked) {
    return {
      key: "app-top",
      path: "/",
      title: "App Top",
    }
  }

  return {
    key: "app-top",
    path: "/",
    title: "App Top",
  }
}
