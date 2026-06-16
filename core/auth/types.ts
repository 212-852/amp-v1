export type SessionRole = "guest" | "user" | "driver" | "admin"

export type SessionTier =
  | "guest"
  | "member"
  | "vip"
  | "trainee"
  | "active"
  | "admin"

export type IdentityState = "anonymous" | "linked" | "logged_in"

export type SourceChannel = "web" | "liff" | "pwa" | "line"

export type SessionOverlayState =
  | "my_page"
  | "menu"
  | "link"
  | "notice"
  | "language"
  | null

export type AssistantState =
  | "bot"
  | "concierge"
  | "idle"
  | "notification"

export type Session = {
  visitor_uuid: string | null
  user_uuid: string | null
  role: SessionRole
  tier: SessionTier
  source_channel: SourceChannel
  can_logout: boolean
  can_start_line_oauth: boolean
}

export type AppSession = Session

export type AmpSession = Session

export type AuthContext = {
  auth_token: string | null
  requested_route: string | null
  source_channel: SourceChannel
  locale: string | null
}

export type IdentityRecord = {
  user_uuid: string | null
  identity_state: IdentityState
  linked_providers: string[]
}

export type AuthRouteResult = {
  path: string
  role: SessionRole
  tier: SessionTier
  identity_state: IdentityState
}
