export type SendMailInput = {
  to: string
  subject: string
  text: string
}

export async function sendMail(input: SendMailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM

  if (!apiKey || !from) {
    throw new Error("Mail sender config is missing")
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    const message = await response.text().catch(() => "")

    throw new Error(message || `Mail send failed: ${response.status}`)
  }
}
