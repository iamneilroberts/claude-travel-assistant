/**
 * Test Results Storage for Voygent QA
 * Stores test sessions and results to KV with 7-day TTL
 */

import type { McpSession } from './mcp-client';
import type { TestScenario } from './scenarios';

// =============================================================================
// TOKEN & COST TRACKING TYPES
// =============================================================================

/**
 * Keys that should be redacted from args for security
 */
const REDACT_KEYS = ['token', 'key', 'auth', 'password', 'secret', 'apiKey', 'authorization'];

/**
 * Redact sensitive fields from MCP call arguments
 */
export function redactArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([k, v]) => [
      k,
      REDACT_KEYS.some(r => k.toLowerCase().includes(r)) ? '[REDACTED]' : v
    ])
  );
}

/**
 * Token usage breakdown
 */
export interface TokenUsage {
  input: number;
  output: number;
  total: number;
  isEstimated: boolean;  // true = calculated from payload size, not real counts
}

/**
 * Detailed record of a single MCP tool call with cost tracking
 */
export interface McpCallDetail {
  seq: number;                    // Call sequence number
  tool: string;                   // Tool name
  argsPreview: string;            // First 200 chars of args, redacted
  argsSize: number;               // Size in bytes
  success: boolean;
  error?: string;
  responseSize: number;           // Size in bytes
  durationMs: number;             // Wall clock time
  tokens: {
    input: number;                // Estimated input tokens
    output: number;               // Estimated output tokens
  };
  cost: number;                   // Estimated cost in USD
  timestamp: string;
}

/**
 * Full token breakdown for a conversation/session
 */
export interface ConversationTokens {
  // MCP tool calls (estimated from payloads)
  mcp: {
    input: number;
    output: number;
    byTool: Record<string, { input: number; output: number; calls: number }>;
  };

  // Claude reasoning (estimated from captured text)
  reasoning: {
    personaGeneration: number;
    tripPlanning: number;
    judgeAnalysis: number;
  };

  // Fixed overhead estimates
  overhead: {
    systemPrompt: number;   // ~3000 tokens for voygent-test.md
    toolSchemas: number;    // ~500 tokens per tool definition
  };

  // Totals
  total: TokenUsage;
}

/**
 * Monthly cost aggregation for dashboard
 */
export interface TestCostSummary {
  month: string;                  // YYYY-MM
  totalCost: number;
  totalSessions: number;
  tokenUsage: TokenUsage;
  avgCostPerSession: number;
  byScenario: Record<string, { cost: number; sessions: number }>;
  byTool: Record<string, { cost: number; calls: number; avgDuration: number }>;
  dailyBreakdown: Array<{ date: string; cost: number; sessions: number }>;
}

/**
 * Cost summary for a single trip (all operations)
 */
export interface TripCostSummary {
  tripId: string;
  totalCost: number;
  tokenUsage: TokenUsage;
  operationCount: number;
  operations: Array<{
    tool: string;
    timestamp: string;
    tokens: { input: number; output: number };
    cost: number;
    durationMs: number;
  }>;
}

// =============================================================================
// TYPES
// =============================================================================

export interface JudgeScores {
  taskCompletion: number;
  uxQuality: number;
  dataQuality: number;
  errorHandling: number;
  overall: number;
}

export interface JudgeFinding {
  type: 'positive' | 'negative' | 'suggestion';
  area: 'ux' | 'data' | 'error' | 'flow';
  description: string;
  evidence: string;
}

export interface ProposedFAQ {
  question: string;
  suggestedAnswer: string;
  evidence: string;
}

export interface JudgeResult {
  scenarioId: string;
  passed: boolean;
  scores: JudgeScores;
  successCriteria: {
    required: Record<string, 'met' | 'not_met'>;
    bonus: Record<string, 'met' | 'not_met'>;
  };
  findings: JudgeFinding[];
  proposedFAQs: ProposedFAQ[];
  summary: string;
}

export interface VisualReviewFinding {
  area: 'layout' | 'content' | 'media' | 'data';
  issue: string;
  severity: 'critical' | 'warning' | 'minor';
}

export interface SuggestedFix {
  issue: string;
  fix: string;
  file?: string;
}

export interface VisualReview {
  enabled: boolean;
  codexFindings: VisualReviewFinding[];
  screenshots?: string[];
  overallAssessment: 'pass' | 'issues_found' | 'fail';
  suggestedFixes: SuggestedFix[];
}

export interface TestSessionResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  tier: 1 | 2 | 3 | 4;  // 4 = realistic user scenarios
  startedAt: string;
  completedAt: string;
  persona: {
    name: string;
    experience: string;
    description?: string;  // Full persona description for realistic scenarios
  };
  tripId?: string;
  previewUrl?: string;
  mcpCallCount: number;
  mcpSuccessCount: number;
  toolsUsed: string[];
  transcript: string;
  agentNotes?: string;  // Test agent's observations and summary
  visualReview?: VisualReview;  // Codex browser-use visual review (when +visual flag used)
  judgeResult?: JudgeResult;

  // Token & Cost Tracking (added for cost visibility)
  tokens?: ConversationTokens;
  costEstimate?: number;           // Total session cost in USD
  modelUsed?: string;              // e.g., "claude-opus-4-5-20251101"
  mcpCallDetails?: McpCallDetail[]; // Detailed per-call breakdown

  // Reasoning capture for token estimation
  reasoning?: {
    persona: string;               // Why this persona was chosen
    structure: string;             // Why trip was structured this way
    judge: string;                 // Judge's full reasoning
  };
}

export interface TestRunSummary {
  id: string;
  startedAt: string;
  completedAt: string;
  scenariosRun: string[];
  results: Array<{
    scenarioId: string;
    passed: boolean;
    overallScore: number;
  }>;
  aggregateScores: JudgeScores;
  passCount: number;
  failCount: number;
}

// =============================================================================
// KV KEY HELPERS
// =============================================================================

const TEST_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const COST_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days for cost aggregates

export function getSessionKey(sessionId: string): string {
  return `_test/sessions/${sessionId}`;
}

export function getRunKey(runId: string): string {
  return `_test/runs/${runId}`;
}

export function getConfigKey(): string {
  return '_test/config';
}

export function getAnalysisKey(date: string): string {
  return `_test/analysis/${date}`;
}

export function getMonthlyCostKey(month: string): string {
  return `_test/costs/${month}`;
}

export function getDailyCostKey(date: string): string {
  return `_test/costs/daily/${date}`;
}

export function getTripCostKey(tripId: string): string {
  return `_costs/trips/${tripId}`;
}

export { TEST_TTL_SECONDS, COST_TTL_SECONDS };

// =============================================================================
// RESULT BUILDERS
// =============================================================================

export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `session-${timestamp}-${random}`;
}

export function generateRunId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `run-${timestamp}-${random}`;
}

export function buildSessionResult(
  scenario: TestScenario,
  session: McpSession,
  transcript: string
): TestSessionResult {
  const summary = {
    totalCalls: session.callHistory.length,
    successfulCalls: session.callHistory.filter(c => c.result.success).length,
    toolsUsed: [...new Set(session.callHistory.map(c => c.tool))]
  };

  return {
    id: generateSessionId(),
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    tier: scenario.tier,
    startedAt: session.callHistory[0]?.timestamp || new Date().toISOString(),
    completedAt: session.callHistory[session.callHistory.length - 1]?.timestamp || new Date().toISOString(),
    persona: {
      name: scenario.persona.name,
      experience: scenario.persona.experience
    },
    mcpCallCount: summary.totalCalls,
    mcpSuccessCount: summary.successfulCalls,
    toolsUsed: summary.toolsUsed,
    transcript
  };
}

export function buildRunSummary(
  sessions: TestSessionResult[]
): TestRunSummary {
  const results = sessions.map(s => ({
    scenarioId: s.scenarioId,
    passed: s.judgeResult?.passed ?? false,
    overallScore: s.judgeResult?.scores.overall ?? 0
  }));

  const validScores = sessions.filter(s => s.judgeResult).map(s => s.judgeResult!.scores);

  const aggregateScores: JudgeScores = validScores.length > 0
    ? {
        taskCompletion: avg(validScores.map(s => s.taskCompletion)),
        uxQuality: avg(validScores.map(s => s.uxQuality)),
        dataQuality: avg(validScores.map(s => s.dataQuality)),
        errorHandling: avg(validScores.map(s => s.errorHandling)),
        overall: avg(validScores.map(s => s.overall))
      }
    : { taskCompletion: 0, uxQuality: 0, dataQuality: 0, errorHandling: 0, overall: 0 };

  return {
    id: generateRunId(),
    startedAt: sessions[0]?.startedAt || new Date().toISOString(),
    completedAt: sessions[sessions.length - 1]?.completedAt || new Date().toISOString(),
    scenariosRun: sessions.map(s => s.scenarioId),
    results,
    aggregateScores,
    passCount: results.filter(r => r.passed).length,
    failCount: results.filter(r => !r.passed).length
  };
}

function avg(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length);
}

// =============================================================================
// KV STORAGE FUNCTIONS (for use in worker routes)
// =============================================================================

/**
 * Save a test session result to KV
 */
export async function saveSessionResult(
  kv: KVNamespace,
  result: TestSessionResult
): Promise<void> {
  await kv.put(
    getSessionKey(result.id),
    JSON.stringify(result),
    { expirationTtl: TEST_TTL_SECONDS }
  );
}

/**
 * Save a test run summary to KV
 */
export async function saveRunSummary(
  kv: KVNamespace,
  summary: TestRunSummary
): Promise<void> {
  await kv.put(
    getRunKey(summary.id),
    JSON.stringify(summary),
    { expirationTtl: TEST_TTL_SECONDS }
  );
}

/**
 * Get a test session result from KV
 */
export async function getSessionResult(
  kv: KVNamespace,
  sessionId: string
): Promise<TestSessionResult | null> {
  return kv.get(getSessionKey(sessionId), 'json');
}

/**
 * Get a test run summary from KV
 */
export async function getRunSummary(
  kv: KVNamespace,
  runId: string
): Promise<TestRunSummary | null> {
  return kv.get(getRunKey(runId), 'json');
}

/**
 * List recent test sessions
 */
export async function listRecentSessions(
  kv: KVNamespace,
  limit: number = 20
): Promise<Array<{ id: string; scenarioId: string; passed?: boolean; completedAt: string }>> {
  const list = await kv.list({ prefix: '_test/sessions/' });
  const sessions: Array<{ id: string; scenarioId: string; passed?: boolean; completedAt: string }> = [];

  // Get most recent sessions (KV list is not sorted, so we need to fetch and sort)
  const keys = list.keys.slice(0, Math.min(limit * 2, list.keys.length));

  for (const key of keys) {
    const session = await kv.get(key.name, 'json') as TestSessionResult | null;
    if (session) {
      sessions.push({
        id: session.id,
        scenarioId: session.scenarioId,
        passed: session.judgeResult?.passed,
        completedAt: session.completedAt
      });
    }
  }

  // Sort by completedAt descending and take limit
  return sessions
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, limit);
}

/**
 * List recent test runs
 */
export async function listRecentRuns(
  kv: KVNamespace,
  limit: number = 10
): Promise<TestRunSummary[]> {
  const list = await kv.list({ prefix: '_test/runs/' });
  const runs: TestRunSummary[] = [];

  const keys = list.keys.slice(0, Math.min(limit * 2, list.keys.length));

  for (const key of keys) {
    const run = await kv.get(key.name, 'json') as TestRunSummary | null;
    if (run) {
      runs.push(run);
    }
  }

  // Sort by completedAt descending and take limit
  return runs
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, limit);
}

// =============================================================================
// PARSE JUDGE OUTPUT
// =============================================================================

/**
 * Parse judge output (handles markdown code blocks)
 */
export function parseJudgeOutput(output: string): JudgeResult | null {
  // Try to extract JSON from markdown code blocks
  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : output;

  try {
    const result = JSON.parse(jsonStr.trim()) as JudgeResult;

    // Validate required fields
    if (
      typeof result.scenarioId !== 'string' ||
      typeof result.passed !== 'boolean' ||
      typeof result.scores?.overall !== 'number'
    ) {
      console.error('Invalid judge result structure');
      return null;
    }

    return result;
  } catch (err) {
    console.error('Failed to parse judge output:', err);
    return null;
  }
}
