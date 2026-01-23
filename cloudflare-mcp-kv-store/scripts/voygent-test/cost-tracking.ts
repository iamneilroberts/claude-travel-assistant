/**
 * Cost Tracking Utilities for Voygent
 *
 * Provides token estimation and cost calculation for MCP calls.
 * Since we're making HTTP calls to the MCP server (not direct Claude API calls),
 * we estimate tokens based on payload sizes.
 */

import type {
  TokenUsage,
  McpCallDetail,
  ConversationTokens,
  TestCostSummary,
  TestSessionResult
} from './results';
import { redactArgs } from './results';

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Rough estimation: ~4 chars per token for JSON
 * This is an approximation - actual tokenization varies with content
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Claude pricing (as of January 2025)
 * Prices are per million tokens
 */
export const PRICING: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  'claude-opus-4-5-20251101': { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  'claude-sonnet-4-20250514': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'claude-haiku-3-5-20241022': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  // Default fallback
  'default': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
};

/**
 * Max characters for args preview (redacted and truncated)
 */
const MAX_ARG_PREVIEW = 200;

/**
 * Overhead estimates for system prompts and tool schemas
 */
const OVERHEAD_ESTIMATES = {
  systemPrompt: 3000,      // ~3000 tokens for voygent-test.md
  toolSchemaPerTool: 500,  // ~500 tokens per tool definition
  defaultToolCount: 15,    // Approximate number of MCP tools
};

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Estimate token count from text/JSON content
 */
export function estimateTokens(content: string | unknown): number {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Calculate cost in USD from token counts
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'default'
): number {
  const pricing = PRICING[model] || PRICING['default'];
  return (
    (inputTokens * pricing.inputPerMillion / 1_000_000) +
    (outputTokens * pricing.outputPerMillion / 1_000_000)
  );
}

/**
 * Truncate and redact args for preview
 */
export function truncateArgsPreview(args: Record<string, unknown>): string {
  const redacted = redactArgs(args);
  const json = JSON.stringify(redacted);
  if (json.length <= MAX_ARG_PREVIEW) {
    return json;
  }
  return json.substring(0, MAX_ARG_PREVIEW - 3) + '...';
}

/**
 * Estimate cost for a single MCP call
 */
export function estimateCallCost(
  args: unknown,
  response: unknown,
  model: string = 'default'
): { inputTokens: number; outputTokens: number; cost: number } {
  const inputTokens = estimateTokens(args);
  const outputTokens = estimateTokens(response);
  const cost = calculateCost(inputTokens, outputTokens, model);

  return { inputTokens, outputTokens, cost };
}

/**
 * Create a detailed call record from MCP call data
 */
export function createCallDetail(
  seq: number,
  tool: string,
  args: Record<string, unknown>,
  success: boolean,
  response: unknown,
  durationMs: number,
  model: string = 'default',
  error?: string
): McpCallDetail {
  const argsJson = JSON.stringify(args);
  const responseJson = JSON.stringify(response);
  const { inputTokens, outputTokens, cost } = estimateCallCost(args, response, model);

  return {
    seq,
    tool,
    argsPreview: truncateArgsPreview(args),
    argsSize: argsJson.length,
    success,
    error,
    responseSize: responseJson.length,
    durationMs,
    tokens: {
      input: inputTokens,
      output: outputTokens,
    },
    cost,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================================
// AGGREGATION
// =============================================================================

/**
 * Aggregate costs from a list of MCP call details
 */
export function aggregateSessionCosts(
  calls: McpCallDetail[],
  reasoningTokens?: { persona?: number; structure?: number; judge?: number }
): { tokenUsage: TokenUsage; costEstimate: number; tokens: ConversationTokens } {
  // Sum up MCP call tokens
  const mcpInput = calls.reduce((sum, c) => sum + c.tokens.input, 0);
  const mcpOutput = calls.reduce((sum, c) => sum + c.tokens.output, 0);

  // Build by-tool breakdown
  const byTool: Record<string, { input: number; output: number; calls: number }> = {};
  for (const call of calls) {
    if (!byTool[call.tool]) {
      byTool[call.tool] = { input: 0, output: 0, calls: 0 };
    }
    byTool[call.tool].input += call.tokens.input;
    byTool[call.tool].output += call.tokens.output;
    byTool[call.tool].calls += 1;
  }

  // Reasoning tokens (if provided)
  const personaGeneration = reasoningTokens?.persona || 0;
  const tripPlanning = reasoningTokens?.structure || 0;
  const judgeAnalysis = reasoningTokens?.judge || 0;

  // Overhead estimates
  const systemPrompt = OVERHEAD_ESTIMATES.systemPrompt;
  const toolSchemas = OVERHEAD_ESTIMATES.toolSchemaPerTool * OVERHEAD_ESTIMATES.defaultToolCount;

  // Calculate totals
  const totalInput = mcpInput + systemPrompt + toolSchemas;
  const totalOutput = mcpOutput + personaGeneration + tripPlanning + judgeAnalysis;
  const totalTokens = totalInput + totalOutput;

  // Calculate cost (using default model pricing)
  const totalCost = calls.reduce((sum, c) => sum + c.cost, 0);

  const tokens: ConversationTokens = {
    mcp: {
      input: mcpInput,
      output: mcpOutput,
      byTool,
    },
    reasoning: {
      personaGeneration,
      tripPlanning,
      judgeAnalysis,
    },
    overhead: {
      systemPrompt,
      toolSchemas,
    },
    total: {
      input: totalInput,
      output: totalOutput,
      total: totalTokens,
      isEstimated: true,
    },
  };

  return {
    tokenUsage: {
      input: totalInput,
      output: totalOutput,
      total: totalTokens,
      isEstimated: true,
    },
    costEstimate: totalCost,
    tokens,
  };
}

/**
 * Build monthly cost summary from test sessions
 */
export function buildMonthlySummary(
  sessions: TestSessionResult[],
  month: string
): TestCostSummary {
  const sessionsInMonth = sessions.filter(s => s.completedAt?.startsWith(month));

  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  const byScenario: Record<string, { cost: number; sessions: number }> = {};
  const byTool: Record<string, { cost: number; calls: number; totalDuration: number }> = {};
  const dailyMap: Record<string, { cost: number; sessions: number }> = {};

  for (const session of sessionsInMonth) {
    const sessionCost = session.costEstimate || 0;
    totalCost += sessionCost;

    if (session.tokens) {
      totalInput += session.tokens.total.input;
      totalOutput += session.tokens.total.output;
    }

    // By scenario
    if (!byScenario[session.scenarioId]) {
      byScenario[session.scenarioId] = { cost: 0, sessions: 0 };
    }
    byScenario[session.scenarioId].cost += sessionCost;
    byScenario[session.scenarioId].sessions += 1;

    // By tool
    if (session.mcpCallDetails) {
      for (const call of session.mcpCallDetails) {
        if (!byTool[call.tool]) {
          byTool[call.tool] = { cost: 0, calls: 0, totalDuration: 0 };
        }
        byTool[call.tool].cost += call.cost;
        byTool[call.tool].calls += 1;
        byTool[call.tool].totalDuration += call.durationMs;
      }
    }

    // Daily breakdown
    const date = session.completedAt?.substring(0, 10) || 'unknown';
    if (!dailyMap[date]) {
      dailyMap[date] = { cost: 0, sessions: 0 };
    }
    dailyMap[date].cost += sessionCost;
    dailyMap[date].sessions += 1;
  }

  // Convert byTool to include avgDuration
  const byToolWithAvg: Record<string, { cost: number; calls: number; avgDuration: number }> = {};
  for (const [tool, data] of Object.entries(byTool)) {
    byToolWithAvg[tool] = {
      cost: data.cost,
      calls: data.calls,
      avgDuration: data.calls > 0 ? Math.round(data.totalDuration / data.calls) : 0,
    };
  }

  // Convert daily map to sorted array
  const dailyBreakdown = Object.entries(dailyMap)
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    month,
    totalCost,
    totalSessions: sessionsInMonth.length,
    tokenUsage: {
      input: totalInput,
      output: totalOutput,
      total: totalInput + totalOutput,
      isEstimated: true,
    },
    avgCostPerSession: sessionsInMonth.length > 0 ? totalCost / sessionsInMonth.length : 0,
    byScenario,
    byTool: byToolWithAvg,
    dailyBreakdown,
  };
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

/**
 * Format cost as USD string
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

/**
 * Format token count with K/M suffix
 */
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toString();
}
