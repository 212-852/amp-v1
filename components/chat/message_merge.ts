"use client"

import type { ChatMessageRecord } from "@/core/chat/types"
import { readMessageMeta } from "@/core/chat/rules"

export function getClientMessageId(message: ChatMessageRecord | null | undefined) {
  const client_message_id = readMessageMeta(message?.payload ?? null).client_message_id

  return typeof client_message_id === "string" && client_message_id.trim()
    ? client_message_id.trim()
    : null
}

export function normalizeRealtimeMessage(
  raw: unknown,
): ChatMessageRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null
  }

  const message = { ...(raw as ChatMessageRecord) }

  if (typeof message.payload === "string") {
    try {
      message.payload = JSON.parse(message.payload) as ChatMessageRecord["payload"]
    } catch {
      message.payload = null
    }
  }

  if (!message.status) {
    message.status = "sent"
  }

  if (!message.body) {
    message.body = ""
  }

  return message
}

export type MessageMergeDebugContext = {
  view: "user" | "concierge"
  current_user_uuid: string | null
  visitor_uuid?: string | null
}

export type MessageMergeResult = {
  messages: ChatMessageRecord[]
  action: "appended" | "duplicate_replaced" | "unchanged"
  incoming_message_uuid: string | null
  incoming_client_message_id: string | null
  sender_uuid: string | null
}

function mergeMessageRecord(
  current: ChatMessageRecord[],
  next_message: ChatMessageRecord,
): MessageMergeResult {
  const incoming_message_uuid = next_message.message_uuid || null
  const incoming_client_message_id = getClientMessageId(next_message)
  let replaced = false
  const merged = current.map((message) => {
    const existing_message_uuid = message.message_uuid || null
    const existing_client_message_id = getClientMessageId(message)
    const matches_message_uuid = Boolean(
      incoming_message_uuid &&
        existing_message_uuid &&
        existing_message_uuid === incoming_message_uuid,
    )
    const is_optimistic_existing = Boolean(
      message.status === "sending" ||
        existing_message_uuid?.startsWith("client:"),
    )
    const matches_client_message_id = Boolean(
      incoming_client_message_id &&
        existing_client_message_id &&
        existing_client_message_id === incoming_client_message_id &&
        (matches_message_uuid || is_optimistic_existing),
    )

    if (matches_message_uuid || matches_client_message_id) {
      replaced = true
      return next_message
    }

    return message
  })

  if (!replaced) {
    merged.push(next_message)
    return {
      messages: merged.sort(
        (left, right) =>
          new Date(left.created_at).getTime() -
          new Date(right.created_at).getTime(),
      ),
      action: "appended",
      incoming_message_uuid,
      incoming_client_message_id,
      sender_uuid: next_message.participant_uuid ?? null,
    }
  }

  return {
    messages: merged.sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime(),
    ),
    action: "duplicate_replaced",
    incoming_message_uuid,
    incoming_client_message_id,
    sender_uuid: next_message.participant_uuid ?? null,
  }
}

export function mergeArchivedResponse(
  current: ChatMessageRecord[],
  next_message: ChatMessageRecord,
) {
  return mergeMessageRecord(current, next_message)
}

export function mergeRealtimeInsert(
  current: ChatMessageRecord[],
  next_message: ChatMessageRecord,
) {
  return mergeMessageRecord(current, next_message)
}

export function appendOptimisticMessage(
  current: ChatMessageRecord[],
  next_message: ChatMessageRecord,
) {
  const incoming_message_uuid = next_message.message_uuid || null
  const incoming_client_message_id = getClientMessageId(next_message)
  const already_exists = current.some((message) => {
    const existing_message_uuid = message.message_uuid || null
    const existing_client_message_id = getClientMessageId(message)

    return Boolean(
      (incoming_message_uuid &&
        existing_message_uuid &&
        incoming_message_uuid === existing_message_uuid) ||
        (incoming_client_message_id &&
          existing_client_message_id &&
          incoming_client_message_id === existing_client_message_id),
    )
  })

  if (already_exists) {
    return {
      messages: current,
      action: "unchanged" as const,
      incoming_message_uuid,
      incoming_client_message_id,
      sender_uuid: next_message.participant_uuid ?? null,
    }
  }

  return {
    messages: [...current, next_message].sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime(),
    ),
    action: "appended" as const,
    incoming_message_uuid,
    incoming_client_message_id,
    sender_uuid: next_message.participant_uuid ?? null,
  }
}
