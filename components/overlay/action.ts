import { resolveOverlayRule } from "@/components/overlay/rules"
import type {
  OverlayAction,
  OverlayContext,
  OverlayRequest,
} from "@/components/overlay/types"

export function createOverlayContext(
  request: OverlayRequest,
): OverlayContext {
  return {
    ...request,
    requestedAt: Date.now(),
  }
}

export function createOverlayAction(request: OverlayRequest): OverlayAction {
  const context = createOverlayContext(request)

  return {
    context,
    rule: resolveOverlayRule(context),
  }
}
