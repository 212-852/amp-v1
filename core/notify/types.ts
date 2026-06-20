export type ChatNotificationPayload = {
  title: string
  body: string
  room_uuid: string
  room_url: string
  receiver_user_uuid: string
}

export type ChatMessageNotifyInput = {
  room_uuid: string
  sender_role: string
  receiver_role?: string
  user_name: string
  request_id?: string | null
}
