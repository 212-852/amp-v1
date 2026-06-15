type SendMailInput = {
  to: string
  subject: string
  text: string
  html?: string
}

type MailResult = {
  ok: boolean
  provider: "resend"
  id?: string | null
}

export async function sendMail(input: SendMailInput): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM ?? process.env.EMAIL_FROM

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
      html: input.html,
    }),
    cache: "no-store",
  })

  const result = (await response.json().catch(() => ({}))) as {
    id?: string
    message?: string
    name?: string
  }

  if (!response.ok) {
    throw new Error(result.message ?? result.name ?? "Failed to send email")
  }

  return {
    ok: true,
    provider: "resend",
    id: result.id ?? null,
  }
}
