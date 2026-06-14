import type { AuthContext, Session } from "@/core/auth/types"

type VisitorRecord = {
  visitor_uuid: string
  user_uuid: string | null
}

type VisitorStore = {
  findVisitorByUuid: (visitor_uuid: string) => Promise<VisitorRecord | null>
  createVisitor: (context: AuthContext) => Promise<VisitorRecord>
}

const runtimeVisitors = new Map<string, VisitorRecord>()

const runtimeVisitorStore: VisitorStore = {
  async findVisitorByUuid(visitor_uuid) {
    return runtimeVisitors.get(visitor_uuid) ?? null
  },

  async createVisitor() {
    const visitor: VisitorRecord = {
      visitor_uuid: crypto.randomUUID(),
      user_uuid: null,
    }

    runtimeVisitors.set(visitor.visitor_uuid, visitor)

    return visitor
  },
}

async function resolveVisitorRecord(
  context: AuthContext,
  visitorStore: VisitorStore,
) {
  if (context.visitor_uuid) {
    const existingVisitor = await visitorStore.findVisitorByUuid(
      context.visitor_uuid,
    )

    if (existingVisitor) {
      return existingVisitor
    }
  }

  return visitorStore.createVisitor(context)
}

export async function resolveSession(
  context: AuthContext,
  visitorStore: VisitorStore = runtimeVisitorStore,
): Promise<Session> {
  const visitor = await resolveVisitorRecord(context, visitorStore)

  return {
    visitor_uuid: visitor.visitor_uuid,
    user_uuid: visitor.user_uuid,
    source_channel: context.source_channel,
  }
}

export type { Session } from "@/core/auth/types"

/** @deprecated Use resolveSession instead */
export async function getAuthSession(context: AuthContext): Promise<Session> {
  return resolveSession(context)
}
