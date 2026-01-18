/**
 * Metrics Wrapper - HOF for wrapping MCP tool handlers with timing and metrics
 */

import type { McpToolHandler, UserProfile, Env } from '../types';
import { recordToolCall } from '../lib/metrics';

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

  // Patch operations - track which fields changed
  if (toolName === 'patch_trip' && args.updates) {
    try {
      const updates = typeof args.updates === 'string' ? JSON.parse(args.updates) : args.updates;
      metadata.fieldsChanged = Object.keys(updates);
    } catch {
      // Ignore parse errors
    }
  }

  // Publishing tools
  if (toolName === 'publish_trip') {
    metadata.category = args.category;
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

    try {
      const result = await handler(args, env, keyPrefix, userProfile, authKey, ctx);
      return result;
    } catch (error) {
      success = false;
      errorType = classifyError(error);
      throw error;
    } finally {
      const durationMs = Math.round(performance.now() - startTime);

      // Extract user info from profile or keyPrefix
      const userId = userProfile?.userId || keyPrefix.replace(/\/$/, '').replace(/_/g, '.');

      // Record metric asynchronously
      recordToolCall(
        env,
        {
          userId,
          userEmail: userProfile?.email,
          userName: userProfile?.name,
          tool: toolName,
          durationMs,
          success,
          errorType,
          metadata: extractMetadata(toolName, args)
        },
        ctx
      );
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
