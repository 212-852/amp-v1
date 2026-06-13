import type { IdentityLinkState } from "@/core/auth/identity"

export function isLinkedIdentity(identity: IdentityLinkState): boolean {
  return identity.linked
}
