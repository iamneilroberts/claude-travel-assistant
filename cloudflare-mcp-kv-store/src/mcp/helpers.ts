/**
 * MCP Response Helpers
 * Utility functions for building MCP responses
 */

import type { JsonRpcResponse } from '../types';

/**
 * Create a successful tool result response
 */
export function createToolResult(
  id: number | string,
  content: string | object
): JsonRpcResponse {
  const textContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: textContent }]
    }
  };
}

/**
 * Create an error tool result response (tool-level error, not RPC error)
 */
export function createToolError(
  id: number | string,
  message: string
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true
    }
  };
}

/**
 * Create a JSON-RPC error response
 */
export function createRpcError(
  id: number | string | null,
  code: number,
  message: string
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message }
  };
}

/**
 * Create a successful result (non-tool)
 */
export function createResult(
  id: number | string,
  result: any
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}
