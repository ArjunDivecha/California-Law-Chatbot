/**
 * Flow Policy
 *
 * Server-enforced workflow boundary between confidential client research,
 * public legal research, and the non-confidential Speed passthrough.
 *
 * The UI explains the rule to attorneys, but only this module is allowed to
 * decide whether a given route may execute a given flow. Direct POSTs that
 * try to sneak a confidential payload through the Speed route — or a Speed
 * passthrough through an Accuracy route — must be rejected here.
 */

export type FlowType =
  | 'accuracy_client'   // confidential client facts, sanitized + Bedrock only
  | 'public_research'   // public-only research (no client facts), Accuracy stack
  | 'speed_passthrough'; // explicitly non-client broad-web Speed answers

export const ALL_FLOW_TYPES: readonly FlowType[] = [
  'accuracy_client',
  'public_research',
  'speed_passthrough',
] as const;

export interface FlowDeclaration {
  flow: FlowType;
}

export interface FlowGuardResult {
  ok: boolean;
  flow?: FlowType;
  status?: number;
  error?: string;
  reason?: string;
}

/**
 * Validate that `body.flow` is present, well-formed, and allowed on the
 * current route.
 */
export function enforceFlow(
  body: unknown,
  allowed: readonly FlowType[]
): FlowGuardResult {
  if (!body || typeof body !== 'object') {
    return {
      ok: false,
      status: 400,
      error: 'invalid_request_body',
      reason: 'Request body must be a JSON object that includes a "flow" field.',
    };
  }

  const candidate = (body as { flow?: unknown }).flow;

  if (typeof candidate !== 'string' || candidate.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'missing_flow',
      reason: 'Request must declare a "flow" field. Allowed values: ' + ALL_FLOW_TYPES.join(', '),
    };
  }

  if (!ALL_FLOW_TYPES.includes(candidate as FlowType)) {
    return {
      ok: false,
      status: 400,
      error: 'invalid_flow',
      reason: `Unknown flow "${candidate}". Allowed values: ${ALL_FLOW_TYPES.join(', ')}`,
    };
  }

  const flow = candidate as FlowType;
  if (!allowed.includes(flow)) {
    return {
      ok: false,
      status: 403,
      error: 'flow_not_allowed_on_route',
      reason: `Flow "${flow}" is not permitted on this route. Allowed: ${allowed.join(', ')}`,
    };
  }

  return { ok: true, flow };
}

/**
 * Convenience: writes the JSON error response for a failed FlowGuardResult.
 * Returns true if the response was sent (caller should then return).
 */
export function rejectFlow(
  res: { status: (code: number) => { json: (body: unknown) => void } },
  result: FlowGuardResult
): boolean {
  if (result.ok) return false;
  res.status(result.status || 400).json({
    error: result.error || 'flow_rejected',
    message: result.reason || 'Flow guard rejected this request.',
  });
  return true;
}

/**
 * The Speed route is explicitly non-client. It may only run speed_passthrough.
 */
export const SPEED_ALLOWED: readonly FlowType[] = ['speed_passthrough'] as const;

/**
 * Accuracy generation/verification routes serve client-confidential and
 * public-research flows. They must never accept speed_passthrough.
 */
export const ACCURACY_ALLOWED: readonly FlowType[] = [
  'accuracy_client',
  'public_research',
] as const;
