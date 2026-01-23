/**
 * Metrics Wrapper - HOF for wrapping MCP tool handlers with timing and metrics
 */

import type { McpToolHandler, UserProfile, Env } from '../types';
import { recordToolCall, updateTripCost } from '../lib/metrics';

// Approximate token estimation: ~4 chars per token
const CHARS_PER_TOKEN = 4;

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
      if (tripId && ['save_trip', 'patch_trip', 'preview_publish', 'publish_trip', 'delete_trip'].includes(toolName)) {
        updateTripCost(
          env,
          keyPrefix,
          tripId,
          {
            tool: toolName,
            inputTokens,
            outputTokens,
            cost: costEstimate,
            durationMs,
            timestamp: new Date().toISOString()
          },
          ctx
        );
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
