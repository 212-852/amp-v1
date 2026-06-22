export const PARTNER_DRIVER_TRIGGER_TEXT = "動物のドライバー"

export const PARTNER_DRIVER_LIFF_URL =
  "https://liff.line.me/2006953406-vj2gYoAb"

export function build_partner_recruitment_message_body() {
  return [
    "パートナードライバー登録フォームをご案内します。",
    "以下の登録フォームから必要事項を送信してください。",
    PARTNER_DRIVER_LIFF_URL,
  ].join("\n")
}

export function build_partner_line_required_prefix() {
  return [
    "パートナードライバー登録はLINE連携が必要です。",
    "",
    "LINE連携後、",
    `「${PARTNER_DRIVER_TRIGGER_TEXT}」`,
    "と送信してください。",
  ].join("\n")
}

export function build_partner_liff_guidance_text() {
  return [
    "パートナードライバー登録をご希望の方は",
    "",
    `「${PARTNER_DRIVER_TRIGGER_TEXT}」`,
    "",
    "と送信してください。",
  ].join("\n")
}

export function build_partner_driver_reply_body(input: {
  line_identity_linked: boolean
}) {
  const recruitment_body = build_partner_recruitment_message_body()

  if (input.line_identity_linked) {
    return recruitment_body
  }

  return [build_partner_line_required_prefix(), recruitment_body].join("\n\n")
}

export function resolve_partner_driver_recruitment(input: {
  text: string
  line_identity_linked?: boolean | null
}) {
  if (input.text.trim() !== PARTNER_DRIVER_TRIGGER_TEXT) {
    return null
  }

  const line_identity_linked = input.line_identity_linked === true

  return {
    should_handle: true,
    message_body: build_partner_driver_reply_body({ line_identity_linked }),
    reason: line_identity_linked
      ? "line_identity_linked"
      : "line_identity_not_linked",
  } as const
}
