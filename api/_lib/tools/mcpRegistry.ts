/**
 * MCP server registry for the V2 agent loop.
 *
 * Per 2026-05-12 fifth addendum: V2 supports the Messages API's
 * `mcp_servers` parameter (beta header `mcp-client-2025-11-20`) for
 * server-side MCP tool dispatch. This registry catalogs the MCP servers
 * V2 KNOWS HOW to talk to; per-server env flags gate which ones are
 * actually active in a deployment. The master `V2_MCP_ENABLED` flag
 * gates the whole subsystem.
 *
 * IMPORTANT — privacy posture (fifth addendum):
 *   The MCP connector is NOT ZDR-eligible. Tool inputs and outputs
 *   that flow through `mcp_servers` are retained on Anthropic's side
 *   per Team-plan trust-and-safety policy (~30 days). For privileged
 *   input, MCP toolsets are OMITTED from the tools array entirely
 *   (privilege_gate = true on each entry below), same posture as
 *   web_search. A privileged input never generates an MCP tool call.
 *
 * Adding a new MCP server: append a McpServerConfig entry below, with
 * its own env flag for opt-in deployment. Production servers should
 * have privilege_gate = true unless their data semantics explicitly
 * tolerate privileged input (almost never the case for public-research
 * tools like CourtListener / Westlaw).
 */

export interface McpServerConfig {
  /** Unique name. Referenced by mcp_toolset entries and mcp_servers entries. */
  name: string;
  /** HTTPS URL of the MCP server (SSE or Streamable HTTP transport). */
  url: string;
  /** Human-readable description for telemetry / debugging. */
  description: string;
  /**
   * Env var holding the bearer / OAuth token. Undefined for public
   * servers (no auth). The loader reads `process.env[auth_token_env]`
   * at call time; missing → no `authorization_token` field in the
   * mcp_servers entry.
   */
  auth_token_env?: string;
  /**
   * When true (default for V2), this MCP toolset is OMITTED from the
   * tools array whenever the input is privileged. The agent loop's
   * privilege gating treats MCP toolsets the same way it treats
   * web_search.
   */
  privilege_gate: boolean;
  /**
   * Per-server enable-flag env var. Must be set to "true" for this
   * server to be active. Even with V2_MCP_ENABLED=true, individual
   * servers stay off unless their per-server flag is also true. This
   * lets us roll out one MCP integration at a time.
   */
  enable_env: string;
}

export const MCP_SERVER_REGISTRY: ReadonlyArray<McpServerConfig> = [
  {
    name: 'free_law_project',
    // PLACEHOLDER URL — the official Free Law Project MCP endpoint /
    // auth shape is not yet cleanly documented in their public-facing
    // materials as of 2026-05-12 (per fifth addendum). Update to the
    // confirmed URL when available; in the meantime this entry is
    // DISABLED by default (enable_env not set in any deployment until
    // the URL is verified).
    url: 'https://mcp.courtlistener.com/sse',
    description:
      'Free Law Project CourtListener MCP — case law, PACER dockets, judge profiles, oral arguments. Privilege-gated.',
    auth_token_env: 'COURTLISTENER_API_KEY',
    privilege_gate: true,
    enable_env: 'V2_MCP_FREE_LAW_PROJECT',
  },
  // ─── Future entries (do NOT enable without confirming endpoint +
  //     subscription + privacy review):
  //
  // {
  //   name: 'tr_cocounsel',
  //   url: 'https://mcp.thomsonreuters.com/cocounsel/sse',
  //   description: 'TR CoCounsel — Westlaw + Practical Law + KeyCite',
  //   auth_token_env: 'TR_COCOUNSEL_API_KEY',
  //   privilege_gate: true,
  //   enable_env: 'V2_MCP_TR_COCOUNSEL',
  // },
  // {
  //   name: 'solve_intelligence',
  //   url: 'https://mcp.solve-intelligence.com/sse',
  //   description: 'Solve Intelligence MCP — citation verification (Phase 3 candidate)',
  //   auth_token_env: 'SOLVE_INTELLIGENCE_API_KEY',
  //   privilege_gate: true,
  //   enable_env: 'V2_MCP_SOLVE_INTELLIGENCE',
  // },
];

/**
 * The list of MCP servers active in the current deployment, after
 * applying the master flag and per-server enable flags. Order is the
 * order of the registry above.
 */
export function activeServers(): McpServerConfig[] {
  if (process.env.V2_MCP_ENABLED !== 'true') return [];
  return MCP_SERVER_REGISTRY.filter(
    (cfg) => process.env[cfg.enable_env] === 'true',
  );
}

/**
 * Spec returned by buildMcpServerSpec — what to pass to the beta
 * messages call. Shape mirrors what the Messages API expects.
 */
export interface McpServerSpec {
  /** The `mcp_servers` parameter on `client.beta.messages.create`. */
  mcp_servers: Array<{
    type: 'url';
    url: string;
    name: string;
    authorization_token?: string;
  }>;
  /** The `{type: 'mcp_toolset', mcp_server_name}` entries for the `tools` array. */
  mcp_toolsets: Array<{
    type: 'mcp_toolset';
    mcp_server_name: string;
  }>;
}

const EMPTY_SPEC: McpServerSpec = { mcp_servers: [], mcp_toolsets: [] };

/**
 * Build the MCP-server spec for one request, with privilege gating
 * applied. When privileged=true, servers with privilege_gate=true are
 * omitted entirely (no mcp_servers entry, no mcp_toolset entry, no
 * tool exposure to the model).
 */
export function buildMcpServerSpec(privileged: boolean): McpServerSpec {
  const servers = activeServers().filter(
    (cfg) => !privileged || !cfg.privilege_gate,
  );
  if (servers.length === 0) return EMPTY_SPEC;
  return {
    mcp_servers: servers.map((s) => ({
      type: 'url' as const,
      url: s.url,
      name: s.name,
      ...(s.auth_token_env && process.env[s.auth_token_env]
        ? { authorization_token: process.env[s.auth_token_env] as string }
        : {}),
    })),
    mcp_toolsets: servers.map((s) => ({
      type: 'mcp_toolset' as const,
      mcp_server_name: s.name,
    })),
  };
}

/** True when at least one MCP toolset will ship for this privilege state. */
export function hasMcpToolsets(privileged: boolean): boolean {
  return buildMcpServerSpec(privileged).mcp_toolsets.length > 0;
}
