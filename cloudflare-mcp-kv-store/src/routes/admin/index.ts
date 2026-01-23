/**
 * Admin Routes - Dispatcher
 * Handles all /admin/* endpoints
 */

import type { Env, RouteHandler } from '../../types';
import { ADMIN_DASHBOARD_HTML } from '../../admin-dashboard';
import { handleListUsers, handleCreateUser, handleGetUser, handleUpdateUser } from './users';
import {
  handleResetNewUser,
  handleResetBranding,
  handleClearMessages,
  handleClearTrips,
  handleResetAccount,
  handleGetDataSummary,
  handleAddSampleTrips
} from './user-tools';
import { handleGetActivity } from './activity';
import { handleGetStats, handleGetBillingStats } from './stats';
import { handleListTrips, handleRebuildSummaries, handleGetTrip } from './trips';
import { handleListComments, handleDeleteComment, handleDeleteAllComments } from './comments';
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
import {
  handleAISupportStatus,
  handleAISupportQueue,
  handleAISupportReview,
  handleAISupportGetSettings,
  handleAISupportUpdateSettings,
  handleAISupportCosts,
  handleAISupportLogs
} from './ai-support';
import {
  handleListPendingKnowledge,
  handleListApprovedKnowledge,
  handleReviewProposal,
  handleDeleteApprovedKnowledge,
  handleKnowledgeStats
} from './knowledge';
import {
  handleMaintenanceStatus,
  handleMaintenanceHistory,
  handleMaintenanceRun
} from './maintenance';
import {
  handleListTestRuns,
  handleListTestSessions,
  handleGetTestSession,
  handleGetTestRun,
  handleTestStats,
  handleProposedFAQs,
  handleTestCleanup,
  handleApproveFAQ,
  handleDismissFAQ,
  handleSaveTestSession,
  handleSaveTestRun
} from './test';
import {
  handleAdminToggleTest,
  handleAdminArchive,
  handleAdminDelete,
  handleAdminCopy,
  handleAdminRename,
  handleAdminMoveTrip
} from './trip-actions';
import {
  handleGetEmailUrl,
  handleGetTripEmailUrl
} from './email';

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
  // User Tools
  handleResetNewUser,
  handleResetBranding,
  handleClearMessages,
  handleClearTrips,
  handleResetAccount,
  handleGetDataSummary,
  handleAddSampleTrips,
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
  handleDeleteComment,
  handleDeleteAllComments,
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
  handleMarkThreadRead,
  // AI Support
  handleAISupportStatus,
  handleAISupportQueue,
  handleAISupportReview,
  handleAISupportGetSettings,
  handleAISupportUpdateSettings,
  handleAISupportCosts,
  handleAISupportLogs,
  // Knowledge Base
  handleListPendingKnowledge,
  handleListApprovedKnowledge,
  handleReviewProposal,
  handleDeleteApprovedKnowledge,
  handleKnowledgeStats,
  // Maintenance
  handleMaintenanceStatus,
  handleMaintenanceHistory,
  handleMaintenanceRun,
  // Test Results
  handleListTestRuns,
  handleListTestSessions,
  handleGetTestSession,
  handleGetTestRun,
  handleTestStats,
  handleProposedFAQs,
  handleTestCleanup,
  handleApproveFAQ,
  handleDismissFAQ,
  handleSaveTestSession,
  handleSaveTestRun,
  // Trip Actions
  handleAdminToggleTest,
  handleAdminArchive,
  handleAdminDelete,
  handleAdminCopy,
  handleAdminRename,
  handleAdminMoveTrip,
  // Email
  handleGetEmailUrl,
  handleGetTripEmailUrl
];

export const handleAdminRoutes: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  // Only handle /admin/* routes
  if (!url.pathname.startsWith("/admin")) return null;

  // Serve dashboard HTML without auth (JS handles auth for API calls)
  if ((url.pathname === "/admin" || url.pathname === "/admin/" || url.pathname === "/admin/dashboard") && request.method === "GET") {
    return new Response(ADMIN_DASHBOARD_HTML, {
      headers: { "Content-Type": "text/html" }
    });
  }

  // Admin MCP endpoint handles its own auth (supports query param for MCP clients)
  if (url.pathname === "/admin/mcp") {
    return handleAdminMcp(request, env, ctx, url, corsHeaders);
  }

  // Admin auth check for API endpoints (header only - query string disabled for security)
  const adminKey = request.headers.get("X-Admin-Key");
  if (!adminKey || adminKey !== env.ADMIN_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  // Try each handler (skip MCP since handled above)
  for (const handler of adminHandlers) {
    if (handler === handleAdminMcp) continue;
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
  handleResetNewUser,
  handleResetBranding,
  handleClearMessages,
  handleClearTrips,
  handleResetAccount,
  handleGetDataSummary,
  handleAddSampleTrips,
  handleGetActivity,
  handleGetStats,
  handleGetBillingStats,
  handleListTrips,
  handleRebuildSummaries,
  handleGetTrip,
  handleListComments,
  handleDeleteComment,
  handleDeleteAllComments,
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
  handleMarkThreadRead,
  handleAISupportStatus,
  handleAISupportQueue,
  handleAISupportReview,
  handleAISupportGetSettings,
  handleAISupportUpdateSettings,
  handleAISupportCosts,
  handleAISupportLogs,
  handleListPendingKnowledge,
  handleListApprovedKnowledge,
  handleReviewProposal,
  handleDeleteApprovedKnowledge,
  handleKnowledgeStats,
  handleListTestRuns,
  handleListTestSessions,
  handleGetTestSession,
  handleGetTestRun,
  handleTestStats,
  handleProposedFAQs,
  handleTestCleanup,
  handleApproveFAQ,
  handleDismissFAQ,
  handleSaveTestSession,
  handleSaveTestRun,
  handleAdminToggleTest,
  handleAdminArchive,
  handleAdminDelete,
  handleAdminCopy,
  handleAdminRename,
  handleAdminMoveTrip,
  handleGetEmailUrl,
  handleGetTripEmailUrl
};
