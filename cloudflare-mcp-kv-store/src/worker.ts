/**
 * Cloudflare Worker MCP Server (JSON-RPC 2.0 via SSE)
 * Entry point - routes to specialized handlers
 */

import type { Env, UserProfile, JsonRpcRequest, JsonRpcResponse } from './types';

// Core utilities (only what's needed for auth flow)
import { listAllKeys, getKeyPrefix } from './lib/kv';
import { getValidAuthKeys, setAuthKeyIndex, getAuthKeyIndex } from './lib/auth';

// Route handlers
import {
  handlePublicRoutes,
  handleAuthRoutes,
  handleStripeRoutes,
  handleSubscribeRoutes,
  handleAdminRoutes
} from './routes';

// MCP protocol handlers
import {
  TOOL_DEFINITIONS,
  handleLifecycleMethod,
  createResult,
  toolHandlers
} from './mcp';

// Base URLs
const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';
const SITE_BASE_URL = 'https://somotravel.us';

// CORS helper - restricts to known domains
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = [
    SITE_BASE_URL,
    "https://www.somotravel.us",
    "https://claude.ai",
    WORKER_BASE_URL,
    "http://localhost:3000",  // Local development
  ];

  // Use the request origin if it's in our allowed list, otherwise use default
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Allow-Credentials": "true",
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for public endpoints
    const corsHeaders = getCorsHeaders(request);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Try public routes first (no auth required)
    const publicResponse = await handlePublicRoutes(request, env, ctx, url, corsHeaders);
    if (publicResponse) return publicResponse;

    // Try subscribe routes (no auth required but need to check before auth routes)
    const subscribeResponse = await handleSubscribeRoutes(request, env, ctx, url, corsHeaders);
    if (subscribeResponse) return subscribeResponse;

    // Try Stripe routes (webhook and API)
    const stripeResponse = await handleStripeRoutes(request, env, ctx, url, corsHeaders);
    if (stripeResponse) return stripeResponse;

    // Try auth routes (upload, gallery - require key param)
    const authResponse = await handleAuthRoutes(request, env, ctx, url, corsHeaders);
    if (authResponse) return authResponse;

    // Admin routes (dashboard, API endpoints)
    const adminResponse = await handleAdminRoutes(request, env, ctx, url, corsHeaders);
    if (adminResponse) return adminResponse;

    // 1. Authentication - check against list of valid keys OR KV users (for MCP endpoints)
    const requestKey = url.searchParams.get("key");
    if (!requestKey) {
      return new Response("Unauthorized - key required", { status: 401 });
    }

    // Check against KV or env var keys first (fast path)
    const validKeys = await getValidAuthKeys(env);
    let keyPrefix: string = '';
    let userProfile: UserProfile | null = null;

    if (validKeys.includes(requestKey)) {
      // Legacy auth via KV or env var
      keyPrefix = getKeyPrefix(requestKey);
    } else {
      // Try auth key index first (O(1))
      const userId = await getAuthKeyIndex(env, requestKey);
      if (userId) {
        const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
        if (user && user.authKey === requestKey) {
          userProfile = user;
          keyPrefix = user.userId + '/';

          // Update lastActive timestamp (async, don't wait)
          ctx.waitUntil((async () => {
            user.lastActive = new Date().toISOString().split('T')[0];
            await env.TRIPS.put(`_users/${userId}`, JSON.stringify(user));
          })());
        }
      }

      // Fallback to scan (for migration) if index miss
      if (!userProfile) {
        const userKeys = await listAllKeys(env, { prefix: "_users/" });
        for (const key of userKeys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (user && user.authKey === requestKey) {
            userProfile = user;
            keyPrefix = user.userId + '/';

            // Backfill index for future lookups
            await setAuthKeyIndex(env, requestKey, user.userId);

            // Update lastActive timestamp (async, don't wait)
            ctx.waitUntil((async () => {
              user.lastActive = new Date().toISOString().split('T')[0];
              await env.TRIPS.put(key.name, JSON.stringify(user));
            })());

            break;
          }
        }
      }

      if (!userProfile) {
        return new Response("Unauthorized - invalid key", { status: 401 });
      }
    }

    // 2. Handle SSE Connection (GET)
    if (request.method === "GET") {
      return new Response("MCP Server Ready (SSE endpoint)", {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        }
      });
    }

    // 3. Handle JSON-RPC Messages (POST)
    if (request.method === "POST") {
      try {
        const body = await request.json() as JsonRpcRequest;
        const response = await handleMcpRequest(body, env, keyPrefix, userProfile, requestKey, ctx);
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null
        }), { status: 400 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  }
};

async function handleMcpRequest(req: JsonRpcRequest, env: Env, keyPrefix: string, userProfile: UserProfile | null, authKey: string, ctx?: ExecutionContext): Promise<JsonRpcResponse> {
  // Handle lifecycle methods (initialize, notifications/initialized)
  const lifecycleResponse = handleLifecycleMethod(req);
  if (lifecycleResponse) return lifecycleResponse;

  // List Tools - use extracted definitions
  if (req.method === "tools/list") {
    return createResult(req.id!, { tools: TOOL_DEFINITIONS });
  }

  // Call Tool - dispatch to extracted handlers
  if (req.method === "tools/call") {
    const { name, arguments: args } = req.params;

    const handler = toolHandlers[name];
    if (handler) {
      try {
        const result = await handler(args || {}, env, keyPrefix, userProfile, authKey, ctx);
        return {
          jsonrpc: "2.0",
          id: req.id!,
          result: {
            content: result.content,
            isError: false
          }
        };
      } catch (err: any) {
        return {
          jsonrpc: "2.0",
          id: req.id!,
          result: {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true
          }
        };
      }
    }

    // Unknown tool
    return {
      jsonrpc: "2.0",
      id: req.id!,
      result: {
        content: [{ type: "text", text: `Error: Unknown tool: ${name}` }],
        isError: true
      }
    };
  }

  // Fallback for unknown methods
  return {
    jsonrpc: "2.0",
    error: { code: -32601, message: "Method not found" },
    id: req.id!
  };
}
