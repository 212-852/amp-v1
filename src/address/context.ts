export type AddressContext = {
  source: "api" | "profile"
}

export function normalize_address_context(source: AddressContext["source"]) {
  return { source } satisfies AddressContext
}
