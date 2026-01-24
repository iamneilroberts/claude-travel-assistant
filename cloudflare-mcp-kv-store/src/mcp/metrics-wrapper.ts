/**
 * Metrics Wrapper - HOF for wrapping MCP tool handlers with timing and metrics
 */

import type { McpToolHandler, UserProfile, Env } from '../types';
import { recordToolCall, updateTripCost } from '../lib/metrics';
import { markDashboardCacheStale } from '../lib/indexes';

// Approximate token estimation: ~4 chars per token
const CHARS_PER_TOKEN = 4;

// All trip-related tools that should be tracked in per-trip cost records
const TRIP_COST_TOOLS = [
  // Write operations
  'save_trip', 'patch_trip', 'delete_trip',
  // Publishing
  'preview_publish', 'publish_trip', 'trip_checklist',
  // Read operations
  'read_trip', 'read_trip_section',
  // Validation & analysis
  'validate_trip', 'analyze_profitability',
  // Media
  'prepare_image_upload', 'add_trip_image'
];

// Tools that mutate trip/comment data and should invalidate the dashboard cache
const CACHE_INVALIDATING_TOOLS = [
  'save_trip', 'patch_trip', 'delete_trip',
  'dismiss_comments', 'add_comment',
  'publish_trip', 'preview_publish'
];

// Sensitive fields to redact from args preview
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'auth', 'credential', 'apiKey'];

/**
 * Generate a preview of args for logging, redacting sensitive fields
 */
function generateArgsPreview(args: Record<string, any>, maxLength: number = 200): string {
  try {
    // Create a shallow copy and redact sensitive fields
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_FIELDS.some(f => lowerKey.includes(f))) {
        redacted[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 100) {
        // Truncate long string values in preview
        redacted[key] = value.substring(0, 100) + '...';
      } else if (typeof value === 'object' && value !== null) {
        // For objects/arrays, just show type and length
        redacted[key] = Array.isArray(value)
          ? `[Array(${value.length})]`
          : `{Object(${Object.keys(value).length} keys)}`;
      } else {
        redacted[key] = value;
      }
    }

    const str = JSON.stringify(redacted);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  } catch {
    return '{}';
  }
}

// Claude pricing (per million tokens)
const PRICING = {
  inputPerMillion: 15.0,   // $15 per 1M input tokens (Opus 4.5)
  outputPerMillion: 75.0,  // $75 per 1M output tokens
};

/**
 * Estimate tokens from content size
 */
function estimateTokens(bytes: number): number {
  return Math.ceil(bytes / CHARS_PER_TOKEN);
}

/**
 * Calculate cost estimate from input/output tokens
 */
function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens * PRICING.inputPerMillion / 1_000_000) +
    (outputTokens * PRICING.outputPerMillion / 1_000_000)
  );
}

/**
 * Error type classification for metrics
 */
function classifyError(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('not found') || msg.includes('does not exist')) {
      return 'not_found';
    }
    if (msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('permission')) {
      return 'auth_error';
    }
    if (msg.includes('validation') || msg.includes('invalid') || msg.includes('required')) {
      return 'validation_error';
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return 'timeout';
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'rate_limit';
    }
    if (msg.includes('network') || msg.includes('connection')) {
      return 'network_error';
    }

    return 'error';
  }

  return 'unknown_error';
}

/**
 * Extract tool-specific metadata from arguments
 */
function extractMetadata(toolName: string, args: Record<string, any>): Record<string, any> | undefined {
  const metadata: Record<string, any> = {};

  // Trip-related tools
  if (args.tripId) {
    metadata.tripId = args.tripId;
  }

  // Template-related tools
  if (args.template) {
    metadata.templateName = args.template;
  }

  // Section reads - capture which section
  if (toolName === 'read_trip_section' && args.section) {
    metadata.section = args.section;
  }

  // Patch operations - track which fields changed
  if (toolName === 'patch_trip' && args.updates) {
    try {
      const updates = typeof args.updates === 'string' ? JSON.parse(args.updates) : args.updates;
      metadata.fieldsChanged = Object.keys(updates);
      // Capture count of changes
      metadata.changeCount = metadata.fieldsChanged.length;
    } catch {
      // Ignore parse errors
    }
  }

  // Save trip - check if it includes key data
  if (toolName === 'save_trip' && args.data) {
    try {
      const data = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
      if (data.meta?.destination) {
        metadata.destination = data.meta.destination;
      }
      if (data.meta?.clientName) {
        metadata.clientName = data.meta.clientName;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Publishing tools
  if (toolName === 'publish_trip') {
    metadata.category = args.category;
  }
  if (toolName === 'preview_publish') {
    metadata.templateName = args.template || 'default';
  }

  // Comments tools
  if (toolName === 'dismiss_comments' && args.commentIds) {
    try {
      const ids = typeof args.commentIds === 'string' ? JSON.parse(args.commentIds) : args.commentIds;
      metadata.commentCount = Array.isArray(ids) ? ids.length : 1;
    } catch {
      // Ignore parse errors
    }
  }

  // Support tools
  if (toolName === 'submit_support') {
    metadata.category = args.category;
    metadata.priority = args.priority;
  }
  if (toolName === 'reply_to_admin' && args.messageId) {
    metadata.messageId = args.messageId;
  }

  // Media tools
  if (toolName === 'youtube_search' && args.query) {
    metadata.searchQuery = args.query.substring(0, 50);
  }
  if (toolName === 'add_trip_image' && args.imageUrl) {
    metadata.imageType = args.imageUrl.includes('r2.') ? 'r2' : 'external';
  }

  // Validation
  if (toolName === 'validate_trip') {
    metadata.validationType = args.sections || 'full';
  }

  // Import
  if (toolName === 'import_quote' && args.source) {
    metadata.importSource = args.source;
  }

  // Search/list tools
  if (args.limit) {
    metadata.limit = args.limit;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

/**
 * Wrap an MCP tool handler with metrics recording
 *
 * @param toolName - The name of the tool being wrapped
 * @param handler - The original tool handler
 * @returns A wrapped handler that records metrics
 */
export function withMetrics(toolName: string, handler: McpToolHandler): McpToolHandler {
  return async (
    args: Record<string, any>,
    env: Env,
    keyPrefix: string,
    userProfile: UserProfile | null,
    authKey: string,
    ctx?: ExecutionContext
  ) => {
    const startTime = performance.now();
    let success = true;
    let errorType: string | undefined;
    let responseBytes: number | undefined;
    let requestBytes: number | undefined;
    let result: any;

    // Measure request size
    try {
      requestBytes = JSON.stringify(args).length;
    } catch {
      requestBytes = 0;
    }

    try {
      result = await handler(args, env, keyPrefix, userProfile, authKey, ctx);

      // Measure response size (bytes, not tokens)
      try {
        responseBytes = JSON.stringify(result).length;
      } catch {
        // Circular references or non-serializable - skip size tracking
      }

      return result;
    } catch (error) {
      success = false;
      errorType = classifyError(error);
      throw error;
    } finally {
      const durationMs = Math.round(performance.now() - startTime);

      // Extract user info from profile or keyPrefix
      const userId = userProfile?.userId || keyPrefix.replace(/\/$/, '').replace(/_/g, '.');

      // Calculate cost estimate
      const inputTokens = estimateTokens(requestBytes || 0);
      const outputTokens = estimateTokens(responseBytes || 0);
      const costEstimate = estimateCost(inputTokens, outputTokens);

      // Record metric asynchronously
      recordToolCall(
        env,
        {
          userId,
          userEmail: userProfile?.email,
          userName: userProfile?.name,
          tool: toolName,
          durationMs,
          responseBytes,
          requestBytes,
          inputTokens,
          outputTokens,
          costEstimate,
          success,
          errorType,
          metadata: extractMetadata(toolName, args)
        },
        ctx
      );

      // Update per-trip cost if this is a trip-related operation
      const tripId = args.tripId || args.trip_id;
      if (tripId && TRIP_COST_TOOLS.includes(toolName)) {
        updateTripCost(
          env,
          keyPrefix,
          tripId,
          {
            tool: toolName,
            argsPreview: generateArgsPreview(args),
            argsSize: requestBytes || 0,
            inputTokens,
            outputTokens,
            responseSize: responseBytes || 0,
            cost: costEstimate,
            durationMs,
            success,
            error: errorType,
            timestamp: new Date().toISOString()
          },
          ctx
        );
      }

      // Invalidate dashboard cache if this was a successful mutation
      if (success && CACHE_INVALIDATING_TOOLS.includes(toolName)) {
        const invalidateCache = markDashboardCacheStale(env);
        if (ctx) {
          ctx.waitUntil(invalidateCache);
        }
        // Don't await - fire and forget
      }
    }
  };
}

/**
 * Wrap multiple handlers at once
 */
export function wrapHandlersWithMetrics(
  handlers: Record<string, McpToolHandler>
): Record<string, McpToolHandler> {
  const wrapped: Record<string, McpToolHandler> = {};

  for (const [name, handler] of Object.entries(handlers)) {
    wrapped[name] = withMetrics(name, handler);
  }

  return wrapped;
}
