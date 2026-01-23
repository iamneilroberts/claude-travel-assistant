/**
 * Test Results Storage for Voygent QA
 * Stores test sessions and results to KV with 7-day TTL
 */

import type { McpSession } from './mcp-client';
import type { TestScenario } from './scenarios';

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
  mcpCallCount: number;
  mcpSuccessCount: number;
  toolsUsed: string[];
  transcript: string;
  agentNotes?: string;  // Test agent's observations and summary
  judgeResult?: JudgeResult;
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
