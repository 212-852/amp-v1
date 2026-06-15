import { sendMail } from "@/core/mail/action"
import type { OtpContext } from "@/core/otp/context"

export function build_otp_email(input: { code: string }) {
  const subject = "AMP login code"
  const text = [
    "Your AMP login code is:",
    "",
    input.code,
    "",
    "This code expires in 10 minutes.",
  ].join("\n")
  const html = [
    "<p>Your AMP login code is:</p>",
    `<p style="font-size:24px;font-weight:700;letter-spacing:4px">${input.code}</p>`,
    "<p>This code expires in 10 minutes.</p>",
  ].join("")

  return { subject, text, html }
}

export async function send_otp_email(
  context: OtpContext,
  input: { code: string },
) {
  const email = build_otp_email(input)

  return sendMail({
    to: context.target,
    subject: email.subject,
    text: email.text,
    html: email.html,
  })
}
