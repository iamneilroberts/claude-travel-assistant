/**
 * Admin MCP Endpoint
 * Provides MCP protocol access for admin tools via Claude Desktop
 *
 * Route: /admin/mcp
 * - GET: Returns SSE endpoint info (for compatibility)
 * - POST: JSON-RPC 2.0 endpoint for MCP messages
 */

import type { Env, RouteHandler, JsonRpcRequest, JsonRpcResponse } from '../../types';
import { getAdminToolDefinitions } from '../../mcp/tools/admin';
import { adminHandlers } from '../../mcp/tools/admin-handlers';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'voygent-admin';
const SERVER_VERSION = '1.0.0';

export const handleAdminMcp: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/mcp') return null;

  // Admin auth check - accept header OR query param for MCP client compatibility
  const adminKey = request.headers.get('X-Admin-Key') || url.searchParams.get('adminKey');
  if (!adminKey || adminKey !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized - admin key required' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Handle GET - return endpoint info
  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      protocol: 'mcp',
      version: PROTOCOL_VERSION,
      server: SERVER_NAME,
      capabilities: ['tools'],
      endpoint: url.origin + '/admin/mcp'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Handle POST - JSON-RPC
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Parse request
  let rpcRequest: JsonRpcRequest;
  try {
    rpcRequest = await request.json() as JsonRpcRequest;
  } catch {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error' },
      id: null
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const { method, params, id } = rpcRequest;

  // Handle MCP methods
  let result: any;

  try {
    switch (method) {
      case 'initialize':
        result = {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION
          }
        };
        break;

      case 'notifications/initialized':
        // Acknowledgement, no response needed
        return new Response('', { status: 204 });

      case 'tools/list':
        result = {
          tools: getAdminToolDefinitions()
        };
        break;

      case 'tools/call':
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (!toolName) {
          return jsonRpcError(id, -32602, 'Missing tool name', corsHeaders);
        }

        const handler = adminHandlers[toolName];
        if (!handler) {
          return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`, corsHeaders);
        }

        try {
          result = await handler(toolArgs, env);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool execution failed';
          return jsonRpcError(id, -32000, message, corsHeaders);
        }
        break;

      case 'ping':
        result = {};
        break;

      default:
        return jsonRpcError(id, -32601, `Method not found: ${method}`, corsHeaders);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    return jsonRpcError(id, -32603, message, corsHeaders);
  }

  // Return success response
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    result,
    id: id ?? null
  };

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

function jsonRpcError(
  id: number | string | undefined,
  code: number,
  message: string,
  corsHeaders: Record<string, string>
): Response {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    error: { code, message },
    id: id ?? null
  };

  return new Response(JSON.stringify(response), {
    status: 200, // JSON-RPC errors use 200 status
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
