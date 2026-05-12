/**
 * Tool registry for the V2 agent loop.
 *
 * Two responsibilities:
 *   1. Build the `tools` array passed to anthropic.messages.create.
 *      The `web_search` Anthropic-native tool is included ONLY when
 *      the input is NOT privileged — §E of the V2 plan. A privileged
 *      input means the model never gets the option to issue a web
 *      search at all, so a privileged term can't appear in a search
 *      query payload.
 *   2. Dispatch a `tool_use` block from the model to the matching
 *      in-process handler and return the `tool_result` block.
 *
 * Anthropic's `web_search_20250305` is a server-side tool — Anthropic
 * runs the search and returns results in the same response. It does
 * NOT appear in our dispatcher map. Our custom tools (ceb_search,
 * courtlistener_search) DO run in-process here.
 */

import {
  CEB_SEARCH_TOOL_DEFINITION,
  cebSearch,
  type CebSearchInput,
} from './cebSearch.js';
import {
  COURTLISTENER_SEARCH_TOOL_DEFINITION,
  courtlistenerSearch,
  type CourtListenerSearchInput,
} from './courtlistenerSearch.js';
import { buildMcpServerSpec, hasMcpToolsets } from './mcpRegistry.js';
export { hasMcpToolsets };

/** Anthropic tool definition shape (server-side, custom, or MCP toolset). */
export type ToolDefinition =
  | typeof CEB_SEARCH_TOOL_DEFINITION
  | typeof COURTLISTENER_SEARCH_TOOL_DEFINITION
  | {
      type: 'web_search_20250305';
      name: 'web_search';
      max_uses: number;
    }
  | {
      type: 'mcp_toolset';
      mcp_server_name: string;
    };

const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'web_search_20250305',
  name: 'web_search',
  max_uses: 3,
};

/**
 * Build the `tools` array for messages.create. When privileged=true,
 * web_search is OMITTED — preventing the model from ever issuing a
 * web-search query containing a privileged term.
 *
 * This is the only privilege gate at the tools-array level. The
 * sanitizer separately tokenizes any privileged spans in the input
 * text BEFORE this is called; this is belt-and-suspenders for the
 * grounding-search vector.
 */
export function buildToolsArray(privileged: boolean): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    CEB_SEARCH_TOOL_DEFINITION,
    COURTLISTENER_SEARCH_TOOL_DEFINITION,
  ];
  if (!privileged) {
    tools.push(WEB_SEARCH_TOOL);
  }
  // MCP toolsets (per 2026-05-12 fifth addendum). Each MCP entry in the
  // registry has its own privilege_gate flag; servers with privilege_gate
  // = true are omitted when privileged=true, parity with web_search.
  const { mcp_toolsets } = buildMcpServerSpec(privileged);
  for (const t of mcp_toolsets) tools.push(t);
  return tools;
}

/**
 * Get the `mcp_servers` parameter spec for the current privilege state.
 * Used by the agent loop to decide whether to call the beta surface
 * (`client.beta.messages.{create,stream}`) and what `mcp_servers` to
 * pass alongside it. Empty array → no MCP this turn → use stable
 * surface.
 */
export function buildMcpServers(privileged: boolean) {
  return buildMcpServerSpec(privileged).mcp_servers;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: 'text'; text: string }>;
  is_error?: boolean;
}

/**
 * Dispatch one tool_use block to its in-process handler. Anthropic's
 * server-side tools (web_search) never reach this function — they're
 * resolved server-side and arrive as content blocks the model
 * incorporates without a separate dispatcher round-trip.
 *
 * Returns a tool_result block ready to append to the next user message
 * in the agent loop.
 */
export async function dispatchTool(use: ToolUseBlock): Promise<ToolResultBlock> {
  try {
    switch (use.name) {
      case 'ceb_search': {
        const result = await cebSearch(use.input as unknown as CebSearchInput);
        return {
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result),
        };
      }
      case 'courtlistener_search': {
        const result = await courtlistenerSearch(
          use.input as unknown as CourtListenerSearchInput,
        );
        return {
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result),
        };
      }
      default:
        return {
          type: 'tool_result',
          tool_use_id: use.id,
          content: `Unknown tool: ${use.name}. This tool is not registered in V2.`,
          is_error: true,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      type: 'tool_result',
      tool_use_id: use.id,
      content: `Tool ${use.name} failed: ${msg}`,
      is_error: true,
    };
  }
}

export { cebSearch, courtlistenerSearch };
export { CEB_SEARCH_TOOL_DEFINITION, COURTLISTENER_SEARCH_TOOL_DEFINITION };
