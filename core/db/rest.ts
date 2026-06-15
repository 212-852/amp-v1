export type RestConfig = {
  url: string
  key: string
}

export type RestError = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

export function getRestConfig(): RestConfig | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_PROJECT_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }

  return { url, key }
}

export function restHeaders(config: RestConfig) {
  return {
    apikey: config.key,
    authorization: `Bearer ${config.key}`,
    "Content-Type": "application/json",
  }
}

export function restUrl(config: RestConfig, table: string, query: string) {
  return `${config.url}/rest/v1/${table}?${query}`
}

export async function readRestError(response: Response): Promise<RestError> {
  return (await response.json().catch(() => ({}))) as RestError
}
