/**
 * MCP JSON-RPC Client for Voygent Test Runner
 * Makes real HTTP calls to the Voygent MCP server
 */

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  success: boolean;
  content: string;
  rawResponse?: unknown;
  error?: string;
}

export interface McpSession {
  authKey: string;
  baseUrl: string;
  callHistory: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: McpToolResult;
    timestamp: string;
  }>;
}

const VOYGENT_TEST_URL = 'https://voygent.somotravel.workers.dev/mcp';

/**
 * Create a new MCP session for testing
 */
export function createSession(authKey: string, baseUrl?: string): McpSession {
  return {
    authKey,
    baseUrl: baseUrl || VOYGENT_TEST_URL,
    callHistory: []
  };
}

/**
 * Make an MCP tool call
 */
export async function callTool(
  session: McpSession,
  tool: McpToolCall
): Promise<McpToolResult> {
  const url = `${session.baseUrl}?key=${encodeURIComponent(session.authKey)}`;

  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: tool.name,
      arguments: tool.arguments
    },
    id: Date.now()
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      const result: McpToolResult = {
        success: false,
        content: '',
        error: `HTTP ${response.status}: ${errorText}`
      };
      session.callHistory.push({
        tool: tool.name,
        args: tool.arguments,
        result,
        timestamp: new Date().toISOString()
      });
      return result;
    }

    const json = await response.json() as {
      jsonrpc: string;
      id: number;
      result?: {
        content: Array<{ type: string; text: string }>;
        isError?: boolean;
      };
      error?: { code: number; message: string };
    };

    if (json.error) {
      const result: McpToolResult = {
        success: false,
        content: '',
        error: json.error.message,
        rawResponse: json
      };
      session.callHistory.push({
        tool: tool.name,
        args: tool.arguments,
        result,
        timestamp: new Date().toISOString()
      });
      return result;
    }

    const content = json.result?.content
      ?.map(c => c.text)
      .join('\n') || '';

    const result: McpToolResult = {
      success: !json.result?.isError,
      content,
      rawResponse: json
    };

    session.callHistory.push({
      tool: tool.name,
      args: tool.arguments,
      result,
      timestamp: new Date().toISOString()
    });

    return result;

  } catch (err) {
    const result: McpToolResult = {
      success: false,
      content: '',
      error: err instanceof Error ? err.message : 'Unknown error'
    };
    session.callHistory.push({
      tool: tool.name,
      args: tool.arguments,
      result,
      timestamp: new Date().toISOString()
    });
    return result;
  }
}

/**
 * Get list of available tools from the server
 */
export async function listTools(session: McpSession): Promise<string[]> {
  const url = `${session.baseUrl}?key=${encodeURIComponent(session.authKey)}`;

  const body = {
    jsonrpc: '2.0',
    method: 'tools/list',
    params: {},
    id: Date.now()
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json() as {
      result?: {
        tools: Array<{ name: string }>;
      };
    };

    return json.result?.tools.map(t => t.name) || [];

  } catch {
    return [];
  }
}

/**
 * Get session summary for reporting
 */
export function getSessionSummary(session: McpSession): {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  toolsUsed: string[];
  errors: string[];
} {
  const successfulCalls = session.callHistory.filter(c => c.result.success);
  const failedCalls = session.callHistory.filter(c => !c.result.success);
  const toolsUsed = [...new Set(session.callHistory.map(c => c.tool))];
  const errors = failedCalls
    .map(c => c.result.error)
    .filter((e): e is string => !!e);

  return {
    totalCalls: session.callHistory.length,
    successfulCalls: successfulCalls.length,
    failedCalls: failedCalls.length,
    toolsUsed,
    errors
  };
}

/**
 * Format session history as a readable transcript
 */
export function formatTranscript(session: McpSession): string {
  const lines: string[] = [];

  for (const call of session.callHistory) {
    lines.push(`[${call.timestamp}] TOOL: ${call.tool}`);
    lines.push(`  ARGS: ${JSON.stringify(call.args, null, 2).split('\n').join('\n  ')}`);

    if (call.result.success) {
      lines.push(`  RESULT: SUCCESS`);
      // Truncate long content
      const content = call.result.content.length > 500
        ? call.result.content.substring(0, 500) + '...(truncated)'
        : call.result.content;
      lines.push(`  CONTENT: ${content.split('\n').join('\n  ')}`);
    } else {
      lines.push(`  RESULT: ERROR`);
      lines.push(`  ERROR: ${call.result.error}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}
