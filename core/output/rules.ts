import { getRestConfig, readRestError, restHeaders, restUrl } from "@/core/db/rest"
import { isContactOnline, type ContactRecord } from "@/core/contacts/rules"
import type { SourceChannel } from "@/core/auth/types"
import {
  validate_line_webhook_reply_token,
  type LineReplyTokenRecord,
} from "@/core/line/reply_token"

export type OutputMessage = {
  text: string
  data?: Record<string, unknown>
  line_messages?: unknown[]
  source_message_uuid?: string | null
  selected_action?: string | null
}

export { resolve_public_app_url } from "@/core/output/uri"

export type OutputTarget = {
  user_uuid?: string | null
  visitor_uuid?: string | null
  channel?: SourceChannel | null
  room_uuid?: string | null
  line_reply_token?: string | null
  line_provider_user_id?: string | null
  line_reply_allowed?: boolean
}

export type OutputTransport =
  | "web"
  | "line_reply"
  | "line_push"
  | "push"
  | "discord"
  | "none"

export type OutputDestination = {
  contact: ContactRecord | null
  transport: OutputTransport
  should_send: boolean
  reason: string
  receiver_channel: SourceChannel | "none"
  line_send_method?: "reply" | "push" | null
  reply_token_record?: LineReplyTokenRecord | null
}

const WEB_SOURCE_CHANNELS = new Set<SourceChannel>(["web", "pwa", "liff"])

const CONTACT_SELECT =
  "user_uuid,visitor_uuid,type,value,channel,state,receive,last_seen_at"

export function isLineWebhookReplyEnabled() {
  return process.env.LINE_WEBHOOK_REPLY_ENABLED === "true"
}

export function is_web_source_channel(
  channel: SourceChannel | null | undefined,
): channel is SourceChannel {
  return Boolean(channel && WEB_SOURCE_CHANNELS.has(channel))
}

function contactTargetQuery(target: OutputTarget) {
  const filters: string[] = []
  const orFilters: string[] = []

  if (target.user_uuid) {
    const userUuid = encodeURIComponent(target.user_uuid)
    filters.push(`user_uuid=eq.${userUuid}`)
    orFilters.push(`user_uuid.eq.${userUuid}`)
  }

  if (target.visitor_uuid) {
    const visitorUuid = encodeURIComponent(target.visitor_uuid)
    filters.push(`visitor_uuid=eq.${visitorUuid}`)
    orFilters.push(`visitor_uuid.eq.${visitorUuid}`)
  }

  if (filters.length === 0) {
    throw new Error("Output target requires user_uuid or visitor_uuid")
  }

  return [
    filters.length === 1 ? filters[0] : `or=(${orFilters.join(",")})`,
    `select=${CONTACT_SELECT}`,
  ].join("&")
}

export async function loadOutputContacts(target: OutputTarget) {
  const config = getRestConfig()

  if (!config) {
    return []
  }

  const response = await fetch(restUrl(config, "contacts", contactTargetQuery(target)), {
    headers: restHeaders(config),
    cache: "no-store",
  })

  if (!response.ok) {
    const error = await readRestError(response)
    throw new Error(
      `Failed to load output contacts: ${error.code ?? "unknown"} ${
        error.message ?? "No PostgREST error returned"
      }`,
    )
  }

  return (await response.json()) as ContactRecord[]
}

export function resolveOutputDestinations(
  contacts: ContactRecord[],
  target: OutputTarget = {},
  now: Date = new Date(),
): OutputDestination[] {
  const source_channel = target.channel ?? null

  if (is_web_source_channel(source_channel)) {
    return [{
      contact: null,
      transport: "web",
      should_send: true,
      reason: "web_channel",
      receiver_channel: source_channel,
      line_send_method: null,
      reply_token_record: null,
    }]
  }

  if (source_channel === "line") {
    const reply_validation = validate_line_webhook_reply_token(target.line_reply_token)
    const reply_enabled = isLineWebhookReplyEnabled()
    const line_reply_allowed = target.line_reply_allowed === true
    const line_contact = contacts.find((contact) => {
      return contact.receive && contact.type === "line"
    })

    if (
      reply_validation.ok &&
      line_reply_allowed &&
      reply_enabled
    ) {
      return [{
        contact: line_contact ?? null,
        transport: "line_reply",
        should_send: true,
        reason: "line_reply_allowed",
        receiver_channel: "line",
        line_send_method: "reply",
        reply_token_record: reply_validation.record,
      }]
    }

    if (target.line_reply_token) {
      return [{
        contact: line_contact ?? null,
        transport: "none",
        should_send: false,
        reason: !line_reply_allowed
          ? "line_reply_not_allowed"
          : !reply_enabled
            ? "line_reply_disabled"
            : `line_reply_token_${reply_validation.reason}`,
        receiver_channel: "line",
        line_send_method: "reply",
        reply_token_record: reply_validation.ok ? reply_validation.record : null,
      }]
    }

    return [{
      contact: line_contact ?? null,
      transport: "line_push",
      should_send: Boolean(line_contact),
      reason: line_contact ? "line_contact_found" : "line_contact_missing",
      receiver_channel: "line",
      line_send_method: "push",
      reply_token_record: null,
    }]
  }

  const destinations: OutputDestination[] = []
  const onlineContact = contacts.find((contact) => {
    return (
      contact.receive &&
      (contact.channel === "web" ||
        contact.channel === "pwa" ||
        contact.channel === "liff") &&
      isContactOnline(contact, now)
    )
  })

  if (onlineContact) {
    return [{
      contact: onlineContact,
      transport: "web",
      should_send: true,
      reason: "online_web_contact",
      receiver_channel: onlineContact.channel,
      line_send_method: null,
      reply_token_record: null,
    }]
  }

  contacts.forEach((contact) => {
    if (!contact.receive) {
      return
    }

    if (contact.type === "line") {
      destinations.push({
        contact,
        transport: "line_push",
        should_send: true,
        reason: "line_contact_found",
        receiver_channel: "line",
        line_send_method: "push",
        reply_token_record: null,
      })
      return
    }

    if (contact.type === "discord") {
      destinations.push({
        contact,
        transport: "discord",
        should_send: true,
        reason: "discord_contact_found",
        receiver_channel: "none",
        line_send_method: null,
        reply_token_record: null,
      })
      return
    }

    if (contact.type === "push") {
      destinations.push({
        contact,
        transport: "push",
        should_send: true,
        reason: "push_contact_found",
        receiver_channel: "none",
        line_send_method: null,
        reply_token_record: null,
      })
    }
  })

  return destinations.length > 0
    ? destinations
    : [{
      contact: null,
      transport: "none",
      should_send: false,
      reason: "destination_missing",
      receiver_channel: "none",
      line_send_method: null,
      reply_token_record: null,
    }]
}

export const LINE_PRIMARY_COLOR = "#06C755"

export const CARD_ACTION_STYLE_LINE_PRIMARY = "line_primary" as const

export const CARD_IMAGE_FIT_CONTAIN = "contain" as const

export const CARD_DEFAULT_ASPECT_RATIO = "20:13"

export type CardActionStyle = typeof CARD_ACTION_STYLE_LINE_PRIMARY

function read_record_value(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export function resolve_card_aspect_ratio(node: Record<string, unknown>) {
  const raw = node.aspect_ratio ?? node.aspectRatio

  if (typeof raw === "string" && /^\d+:\d+$/.test(raw.trim())) {
    return raw.trim()
  }

  return CARD_DEFAULT_ASPECT_RATIO
}

export function should_use_line_primary_button(node: Record<string, unknown>) {
  if (node.style === "link" || node.style === "secondary") {
    return false
  }

  if (node.action_style === CARD_ACTION_STYLE_LINE_PRIMARY) {
    return true
  }

  return node.style === "primary"
}

export function should_apply_card_hero_fit(node: Record<string, unknown>) {
  if (node.type !== "image") {
    return false
  }

  if (node.image_fit === CARD_IMAGE_FIT_CONTAIN) {
    return true
  }

  if (node.aspectMode === "cover") {
    return true
  }

  return node.size === "full" && typeof node.url === "string"
}

export function build_card_hero(input: {
  url: string
  aspect_ratio?: string
}) {
  return {
    type: "image",
    url: input.url,
    image_fit: CARD_IMAGE_FIT_CONTAIN,
    aspect_ratio: input.aspect_ratio ?? CARD_DEFAULT_ASPECT_RATIO,
  }
}

export function build_card_primary_button(input: {
  label: string
  action: Record<string, unknown>
  height?: string
  cornerRadius?: string
}) {
  return {
    type: "button",
    action_style: CARD_ACTION_STYLE_LINE_PRIMARY,
    height: input.height ?? "sm",
    cornerRadius: input.cornerRadius,
    action: {
      ...input.action,
      label: input.label,
    },
  }
}

export function apply_line_card_button(node: Record<string, unknown>) {
  if (!should_use_line_primary_button(node)) {
    return node
  }

  const next = { ...node }
  delete next.action_style
  delete next.color
  next.style = "primary"
  next.color = LINE_PRIMARY_COLOR
  return next
}

export function apply_line_card_hero(node: Record<string, unknown>) {
  const next = { ...node }
  delete next.image_fit
  delete next.aspect_ratio
  next.type = "image"
  next.size = "full"
  next.aspectMode = "fit"
  next.aspectRatio = resolve_card_aspect_ratio(node)
  return next
}

export function resolve_web_card_button_style(node: Record<string, unknown>) {
  if (!should_use_line_primary_button(node)) {
    if (node.style === "secondary") {
      return {
        backgroundColor: "#F4E8D8",
        color: "#3D2A19",
        border: "none",
      }
    }

    return null
  }

  return {
    backgroundColor: LINE_PRIMARY_COLOR,
    color: "#FFFFFF",
    border: "none",
  }
}

export const WEB_CARD_HERO_CLASS =
  "block h-auto w-full object-contain rounded-t-[18px]"
