export type ChatNotificationPayload = {
  title: string
  body: string
  room_uuid: string
  room_url: string
  receiver_user_uuid: string
  contact_uuid?: string | null
  selected_channel?: "push" | "line" | null
  contact_receive?: boolean | null
  contact_state?: string | null
  contact_channel?: string | null
}

export type ChatMessageNotifyInput = {
  room_uuid: string
  message_uuid?: string | null
  sender_uuid?: string | null
  sender_participant_uuid?: string | null
  sender_role: string
  user_name: string
  message_body?: string | null
  message_type?: string | null
  source_channel?: string | null
  request_id?: string | null
}
