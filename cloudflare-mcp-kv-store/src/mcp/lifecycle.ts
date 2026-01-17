/**
 * MCP Lifecycle Handlers
 * Handles initialize and notification methods
 */

import type { JsonRpcRequest, JsonRpcResponse } from '../types';
import { createResult } from './helpers';

/**
 * Handle MCP initialization request
 */
export function handleInitialize(req: JsonRpcRequest): JsonRpcResponse {
  return createResult(req.id!, {
    protocolVersion: "2024-11-05",
    capabilities: { tools: {} },
    serverInfo: { name: "claude-travel-store", version: "1.0.0" }
  });
}

/**
 * Handle initialized notification
 */
export function handleInitialized(req: JsonRpcRequest): JsonRpcResponse {
  return createResult(req.id!, true);
}

/**
 * Check if this is a lifecycle method
 */
export function isLifecycleMethod(method: string): boolean {
  return method === 'initialize' || method === 'notifications/initialized';
}

/**
 * Handle a lifecycle method
 */
export function handleLifecycleMethod(req: JsonRpcRequest): JsonRpcResponse | null {
  if (req.method === 'initialize') {
    return handleInitialize(req);
  }
  if (req.method === 'notifications/initialized') {
    return handleInitialized(req);
  }
  return null;
}
