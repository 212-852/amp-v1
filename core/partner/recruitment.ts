export const PARTNER_DRIVER_TRIGGER_TEXT = "動物のドライバー"

export const PARTNER_DRIVER_RECRUIT_BODY = "partner_driver_recruit"

export const PARTNER_DRIVER_LIFF_URL =
  "https://liff.line.me/2006953406-vj2gYoAb"

export const PARTNER_DRIVER_RECRUIT_IMAGE = "/images/recruit.jpg"

export const PARTNER_DRIVER_RECRUIT_ALT_TEXT = "パートナードライバー募集"

export const PARTNER_DRIVER_RECRUIT_TITLE = "パートナードライバー募集"

export const PARTNER_DRIVER_RECRUIT_DESCRIPTION =
  "ペットとご家族の移動を、\nやさしく支えるお仕事です。"

export const PARTNER_DRIVER_RECRUIT_BUTTON_LABEL = "登録フォームへ"

export const PARTNER_DRIVER_REGISTER_PATH = "/driver/register"

export function build_partner_liff_guidance_text() {
  return [
    "パートナードライバー登録をご希望の方は",
    "",
    `「${PARTNER_DRIVER_TRIGGER_TEXT}」`,
    "",
    "と送信してください。",
  ].join("\n")
}
