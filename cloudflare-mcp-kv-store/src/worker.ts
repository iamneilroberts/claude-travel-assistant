/**
 * Cloudflare Worker MCP Server (JSON-RPC 2.0 via SSE)
 * Entry point - routes to specialized handlers
 */

import type { Env, UserProfile, JsonRpcRequest, JsonRpcResponse } from './types';

// Core utilities (only what's needed for auth flow)
import { listAllKeys, getKeyPrefix, getLegacyKeyPrefix } from './lib/kv';
import { getValidAuthKeys, setAuthKeyIndex, getAuthKeyIndex } from './lib/auth';

// Route handlers
import {
  handlePublicRoutes,
  handleAuthRoutes,
  handleStripeRoutes,
  handleSubscribeRoutes,
  handleAdminRoutes
} from './routes';

// Subdomain routing
import { handleSubdomainRoutes } from './routes/subdomain';
import { generateTrialSubdomain, setSubdomainOwner, getUserSubdomain } from './lib/subdomain';

// MCP protocol handlers
import {
  TOOL_DEFINITIONS,
  handleLifecycleMethod,
  createResult,
  toolHandlers
} from './mcp';

// AI Support (disabled - API key removed, but code retained for future use)
import { retryFailedTickets } from './ai-support';

// Scheduled maintenance tasks
import { runMaintenance } from './lib/maintenance';

// Base URLs
const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';
const SITE_BASE_URL = 'https://somotravel.us';

// CORS helper - restricts to known domains
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  // SECURITY: Only allow production origins in CORS
  // Removed localhost:3000 to prevent potential development leakage
  const allowedOrigins = [
    SITE_BASE_URL,
    "https://www.somotravel.us",
    "https://claude.ai",
    WORKER_BASE_URL,
  ];

  // Check if origin is in allowed list OR is a *.voygent.ai subdomain
  const isAllowedOrigin = allowedOrigins.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.voygent\.ai$/.test(origin);

  // Use the request origin if allowed, otherwise use default
  const allowOrigin = isAllowedOrigin ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Allow-Credentials": "true",
  };
}

export default {
  // Handle HTTP requests
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for public endpoints
    const corsHeaders = getCorsHeaders(request);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Try subdomain routing first (*.voygent.ai)
    const subdomainResponse = await handleSubdomainRoutes(request, env, ctx, url, corsHeaders);
    if (subdomainResponse) return subdomainResponse;

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
    // Accept both "key" and "authKey" params (docs use authKey, legacy uses key)
    const requestKey = url.searchParams.get("key") || url.searchParams.get("authKey");
    if (!requestKey) {
      return new Response("Unauthorized - key required", { status: 401 });
    }

    // Check against KV or env var keys first (fast path)
    const validKeys = await getValidAuthKeys(env);
    let keyPrefix: string = '';
    let userProfile: UserProfile | null = null;

    if (validKeys.includes(requestKey)) {
      // Legacy auth via KV or env var
      // SECURITY NOTE: Use getLegacyKeyPrefix for backward compatibility with existing data
      // New users should use the _users/ system which doesn't have collision risk
      keyPrefix = getLegacyKeyPrefix(requestKey);

      // Also try to load user profile for legacy keys (needed for subdomain, subscription)
      const userId = keyPrefix.replace(/\/$/, '');
      const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile | null;
      if (user) {
        userProfile = user;
      }
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

    // Auto-assign subdomain if user doesn't have one (ensures all users get voygent.ai URLs)
    if (userProfile && !userProfile.subdomain) {
      const existingSubdomain = await getUserSubdomain(env, userProfile.userId);
      if (existingSubdomain) {
        // Subdomain exists in mapping but not on profile - sync it
        userProfile.subdomain = existingSubdomain;
        ctx.waitUntil(env.TRIPS.put(`_users/${userProfile.userId}`, JSON.stringify(userProfile)));
      } else {
        // Generate and assign new trial subdomain
        const newSubdomain = generateTrialSubdomain(userProfile.userId);
        await setSubdomainOwner(env, newSubdomain, userProfile.userId);
        userProfile.subdomain = newSubdomain;
        ctx.waitUntil(env.TRIPS.put(`_users/${userProfile.userId}`, JSON.stringify(userProfile)));
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
      let body: JsonRpcRequest;
      let rawBody: string | undefined;

      // Step 1: Parse JSON with detailed error reporting
      try {
        rawBody = await request.text();
        body = JSON.parse(rawBody) as JsonRpcRequest;
      } catch (err) {
        // Provide detailed parse error with context
        const errorMessage = err instanceof SyntaxError
          ? `JSON parse error: ${err.message}`
          : `Parse error: ${err instanceof Error ? err.message : 'Unknown error'}`;

        // Include snippet of problematic JSON (first 200 chars)
        const snippet = rawBody
          ? ` | Received (first 200 chars): ${rawBody.substring(0, 200).replace(/\n/g, '\\n')}${rawBody.length > 200 ? '...' : ''}`
          : '';

        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32700,
            message: errorMessage + snippet
          },
          id: null
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Step 2: Handle MCP request with guaranteed response
      try {
        const response = await handleMcpRequest(body, env, keyPrefix, userProfile, requestKey, ctx);

        // Guard against null/undefined responses (should never happen but prevents silent failures)
        if (!response) {
          console.error(`MCP handler returned null/undefined for method: ${body.method}`);
          return new Response(JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: `Internal error: handler returned no response for ${body.method}` },
            id: body.id || null
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        // Handler threw an unexpected error - always return structured response
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`MCP handler error for ${body.method}:`, err);
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32603, message: `Internal error: ${errorMessage}` },
          id: body.id || null
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  },

  // Handle scheduled cron jobs
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === '*/15 * * * *') {
      // Run maintenance tasks (cleanup, archiving, index validation)
      await runMaintenance(env);

      // AI support retry (disabled - no API key, but kept for future use)
      // Will gracefully skip if AI support is disabled or API key missing
      try {
        await retryFailedTickets(env);
      } catch (e) {
        // Expected to fail without ANTHROPIC_API_KEY - ignore
      }
    }
  }
};

async function handleMcpRequest(req: JsonRpcRequest, env: Env, keyPrefix: string, userProfile: UserProfile | null, authKey: string, ctx?: ExecutionContext): Promise<JsonRpcResponse> {
  // Handle lifecycle methods (initialize, notifications/initialized)
  const lifecycleResponse = handleLifecycleMethod(req);
  if (lifecycleResponse) return lifecycleResponse;

  // List Tools - return all tool definitions (filtered for test users)
  if (req.method === "tools/list") {
    // Test users don't see publish_trip in tool list
    const isTestUser = authKey.startsWith('TestRunner.');
    const RESTRICTED_TOOLS_FOR_TEST = ['publish_trip'];

    const tools = isTestUser
      ? TOOL_DEFINITIONS.filter(t => !RESTRICTED_TOOLS_FOR_TEST.includes(t.name))
      : TOOL_DEFINITIONS;

    return createResult(req.id!, { tools });
  }

  // Call Tool - dispatch to extracted handlers
  if (req.method === "tools/call") {
    const { name, arguments: args } = req.params;

    // Test user tool restrictions
    // Test users (authKey starting with "TestRunner.") cannot use publish_trip
    const isTestUser = authKey.startsWith('TestRunner.');
    const RESTRICTED_TOOLS_FOR_TEST = ['publish_trip'];

    if (isTestUser && RESTRICTED_TOOLS_FOR_TEST.includes(name)) {
      return {
        jsonrpc: "2.0",
        id: req.id!,
        result: {
          content: [{ type: "text", text: `Error: Tool "${name}" is restricted for test users. Use preview_publish instead.` }],
          isError: true
        }
      };
    }

    const handler = toolHandlers[name];
    if (handler) {
      try {
        const result = await handler(args || {}, env, keyPrefix, userProfile, authKey, ctx);

        // Guard against handlers returning null/undefined (prevents silent failures)
        if (!result || !result.content) {
          console.error(`Tool handler '${name}' returned invalid result:`, result);
          return {
            jsonrpc: "2.0",
            id: req.id!,
            result: {
              content: [{ type: "text", text: `Error: Tool '${name}' completed but returned no content. This is a bug - please report it.` }],
              isError: true
            }
          };
        }

        return {
          jsonrpc: "2.0",
          id: req.id!,
          result: {
            content: result.content,
            isError: false
          }
        };
      } catch (err: any) {
        // Always return a structured error response
        const errorMsg = err?.message || String(err) || 'Unknown error';
        console.error(`Tool handler '${name}' threw error:`, err);
        return {
          jsonrpc: "2.0",
          id: req.id!,
          result: {
            content: [{ type: "text", text: `Error: ${errorMsg}` }],
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
