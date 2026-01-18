/**
 * Admin Routes - Dispatcher
 * Handles all /admin/* endpoints
 */

import type { Env, RouteHandler } from '../../types';
import { ADMIN_DASHBOARD_HTML } from '../../admin-dashboard';
import { handleListUsers, handleCreateUser, handleGetUser, handleUpdateUser } from './users';
import { handleGetActivity } from './activity';
import { handleGetStats, handleGetBillingStats } from './stats';
import { handleListTrips, handleRebuildSummaries, handleGetTrip } from './trips';
import { handleListComments } from './comments';
import { handleListSupport, handleUpdateSupport } from './support';
import { handleListPromoCodes, handleCreatePromoCode, handleDeletePromoCode } from './promo-codes';
import {
  handleListMessages,
  handleCreateBroadcast,
  handleDeleteBroadcast,
  handleSendDirectMessage,
  handleGetThread,
  handleUpdateThread,
  handleMarkThreadRead
} from './messages';
import { handleActivityStream } from './activity-stream';
import { handleMetricsSummary } from './metrics-summary';
import { handleInsights } from './insights';
import { handleAdminMcp } from './mcp';

// All admin route handlers
const adminHandlers: RouteHandler[] = [
  // Admin MCP endpoint (authenticated separately)
  handleAdminMcp,
  // Metrics & Activity Stream (new)
  handleActivityStream,
  handleMetricsSummary,
  handleInsights,
  // Users
  handleListUsers,
  handleCreateUser,
  handleGetUser,
  handleUpdateUser,
  // Activity
  handleGetActivity,
  // Stats
  handleGetStats,
  handleGetBillingStats,
  // Trips
  handleListTrips,
  handleRebuildSummaries,
  handleGetTrip,
  // Comments
  handleListComments,
  // Support
  handleListSupport,
  handleUpdateSupport,
  // Promo codes
  handleListPromoCodes,
  handleCreatePromoCode,
  handleDeletePromoCode,
  // Messages
  handleListMessages,
  handleCreateBroadcast,
  handleDeleteBroadcast,
  handleSendDirectMessage,
  handleGetThread,
  handleUpdateThread,
  handleMarkThreadRead
];

export const handleAdminRoutes: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  // Only handle /admin/* routes
  if (!url.pathname.startsWith("/admin")) return null;

  // Serve dashboard HTML without auth (JS handles auth for API calls)
  if (url.pathname === "/admin/dashboard" && request.method === "GET") {
    return new Response(ADMIN_DASHBOARD_HTML, {
      headers: { "Content-Type": "text/html" }
    });
  }

  // Admin auth check for API endpoints (header only - query string disabled for security)
  const adminKey = request.headers.get("X-Admin-Key");
  if (!adminKey || adminKey !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Try each handler
  for (const handler of adminHandlers) {
    const response = await handler(request, env, ctx, url, corsHeaders);
    if (response) return response;
  }

  // No handler matched
  return new Response(JSON.stringify({ error: "Admin endpoint not found" }), {
    status: 404,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
};

// Re-export individual handlers for direct imports if needed
export {
  handleListUsers,
  handleCreateUser,
  handleGetUser,
  handleUpdateUser,
  handleGetActivity,
  handleGetStats,
  handleGetBillingStats,
  handleListTrips,
  handleRebuildSummaries,
  handleGetTrip,
  handleListComments,
  handleListSupport,
  handleUpdateSupport,
  handleListPromoCodes,
  handleCreatePromoCode,
  handleDeletePromoCode,
  handleListMessages,
  handleCreateBroadcast,
  handleDeleteBroadcast,
  handleSendDirectMessage,
  handleGetThread,
  handleUpdateThread,
  handleMarkThreadRead
};
