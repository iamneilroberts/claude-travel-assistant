/**
 * Voygent Test Runner - Main Entry Point
 *
 * This file is documentation for Claude Code on how to run Voygent tests.
 * Tests are executed via Task subagents within Claude Code sessions.
 *
 * ## Usage (Natural Language Commands)
 *
 * Run a specific test:
 *   "Run the onboarding test scenario"
 *   "Run the crud-basic test"
 *
 * Run all core tests:
 *   "Run the core Voygent tests"
 *
 * Run tests by tier:
 *   "Run Tier 1 tests" (core flows)
 *   "Run Tier 2 tests" (feature coverage)
 *   "Run Tier 3 tests" (edge cases)
 *
 * View results:
 *   "Show me the last 5 test results"
 *   "Get the test statistics"
 *
 * ## Architecture
 *
 * 1. Claude Code receives a test command
 * 2. It spawns a Test Agent (Task subagent) with:
 *    - The scenario persona and task
 *    - MCP client access to call Voygent tools
 * 3. Test Agent role-plays as the persona, making real MCP calls
 * 4. After completion, Judge Agent evaluates the transcript
 * 5. Results are saved to KV via admin API
 *
 * ## Test Auth Key
 *
 * Tests use a dedicated auth key: TestRunner.test123
 * This key has restrictions (can't use publish_trip)
 */

import {
  ALL_SCENARIOS,
  getScenario,
  getScenariosByTier,
  getCoreScenarios,
  type TestScenario
} from './scenarios';

import {
  createSession,
  callTool,
  listTools,
  getSessionSummary,
  formatTranscript,
  type McpSession
} from './mcp-client';

import {
  buildTestAgentPrompt,
  JUDGE_SYSTEM_PROMPT,
  buildJudgePrompt,
  DEFAULT_TEST_CONFIG,
  type TestConfig
} from './prompts';

import {
  buildSessionResult,
  buildRunSummary,
  parseJudgeOutput,
  type TestSessionResult,
  type TestRunSummary,
  type JudgeResult
} from './results';

// =============================================================================
// CONFIGURATION
// =============================================================================

export const TEST_AUTH_KEY = 'TestRunner.test123';
export const TEST_BASE_URL = 'https://voygent.somotravel.workers.dev/mcp';

// =============================================================================
// RUNNER INSTRUCTIONS FOR CLAUDE CODE
// =============================================================================

/**
 * Instructions for Claude Code when running Voygent tests
 */
export const TEST_RUNNER_INSTRUCTIONS = `
# How to Run Voygent Tests

When asked to run Voygent tests, follow this process:

## 1. Identify the Scenario(s)

Based on the user's request, determine which scenarios to run:
- "onboarding test" → scenario ID: "onboarding-fresh"
- "CRUD test" → scenario ID: "crud-basic"
- "publish test" → scenario ID: "publish-preview"
- "core tests" → Tier 1 scenarios (all 3)
- "Tier 2 tests" → Feature coverage scenarios
- "Tier 3 tests" → Edge case scenarios
- "Tier 4 tests" or "realistic tests" → Realistic user scenarios
- "disney test" → "disney-busy-mom"
- "retiree test" or "alaska test" → "retiree-alaska-cruise"
- "wedding test" → "destination-wedding"
- "business test" → "business-plus-leisure"
- "backpacker test" → "gap-year-backpacker"
- "anniversary test" → "surprise-anniversary"
- "reunion test" → "family-reunion-chaos"
- "solo test" or "portugal test" → "solo-female-traveler"
- "panic test" or "last minute test" → "last-minute-panic"
- "girls trip test" or "group test" → "group-trip-drama"

## 2. For Each Scenario, Run a Test Agent

Spawn a Task subagent with the test agent prompt. The agent should:

a) Create an MCP session using the test auth key
b) Role-play as the persona AUTHENTICALLY - use their speech patterns, concerns, interruptions
c) Make real MCP tool calls to interact with Voygent
d) Complete the task or report blockers
e) Take notes on what worked well and what was confusing

Example test agent invocation prompt:
\`\`\`
You are testing Voygent as a simulated user.

[Include buildTestAgentPrompt output here]

IMPORTANT: Stay in character! If you're Michelle the busy mom, get interrupted mid-thought.
If you're the retired couple, have "Jim" interject. Make it feel REAL.

Available MCP tools (call via HTTP POST to Voygent):
- get_context, list_trips, read_trip, save_trip, patch_trip, delete_trip
- preview_publish (publish_trip is BLOCKED for tests)
- get_comments, reply_to_comment, dismiss_comments
- submit_support, log_support_intent

Use the mcp-client functions to make calls:
- createSession(authKey)
- callTool(session, { name: 'tool_name', arguments: {...} })

Complete the scenario task, then report:
1. Full transcript of your interaction
2. What worked well
3. What was confusing or frustrating
4. Suggestions for improvement
\`\`\`

## 3. Run the Judge Agent

After the test agent completes, spawn a Judge agent with:
- The scenario details
- The transcript from the test agent
- The judge system prompt

The judge outputs a structured JSON evaluation.

## 4. Save Results to Admin Dashboard

**CRITICAL: Results must be saved to appear in the admin dashboard!**

Use curl or fetch to POST results to the admin API:

\`\`\`bash
# Save test session
curl -X POST "https://voygent.somotravel.workers.dev/admin/test/sessions" \\
  -H "X-Admin-Key: $ADMIN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "session-xxx-yyy",
    "scenarioId": "disney-busy-mom",
    "scenarioName": "Busy Mom Plans Disney",
    "tier": 4,
    "startedAt": "2025-01-22T...",
    "completedAt": "2025-01-22T...",
    "persona": {
      "name": "Michelle Torres",
      "experience": "new",
      "description": "Working mom of 3 kids..."
    },
    "mcpCallCount": 8,
    "mcpSuccessCount": 7,
    "toolsUsed": ["get_context", "save_trip", "read_trip"],
    "transcript": "...",
    "agentNotes": "...",
    "judgeResult": { ... }
  }'

# Save test run (if multiple scenarios)
curl -X POST "https://voygent.somotravel.workers.dev/admin/test/runs" \\
  -H "X-Admin-Key: $ADMIN_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "id": "run-xxx-yyy",
    "startedAt": "...",
    "completedAt": "...",
    "scenariosRun": ["disney-busy-mom", "retiree-alaska-cruise"],
    "results": [...],
    "aggregateScores": {...},
    "passCount": 2,
    "failCount": 0
  }'
\`\`\`

The ADMIN_KEY is stored in the .env file.

## 5. Report to User

Summarize:
- Which scenarios ran
- Pass/fail status for each
- Key findings from realistic user simulation
- Any proposed FAQs
- Link to admin dashboard to view full results
`;

// =============================================================================
// HELPER TYPES FOR CLAUDE CODE
// =============================================================================

export interface TestRunConfig {
  scenarios: string[];  // Scenario IDs to run
  authKey?: string;     // Override auth key
  baseUrl?: string;     // Override MCP URL
}

export interface TestRunResult {
  runId: string;
  sessions: TestSessionResult[];
  summary: TestRunSummary;
}

// =============================================================================
// SCENARIO LOOKUP HELPERS
// =============================================================================

export function getScenarioForCommand(command: string): TestScenario | TestScenario[] | null {
  const lower = command.toLowerCase();

  // Tier 1: Core scenarios
  if (lower.includes('onboarding')) return getScenario('onboarding-fresh') || null;
  if (lower.includes('crud')) return getScenario('crud-basic') || null;
  if (lower.includes('publish') && !lower.includes('preview')) return getScenario('publish-preview') || null;

  // Tier 2: Feature scenarios
  if (lower.includes('cruise') && !lower.includes('alaska')) return getScenario('cruise-workflow') || null;
  if (lower.includes('multi-destination') || lower.includes('europe tour')) return getScenario('multi-destination') || null;
  if (lower.includes('comment')) return getScenario('client-comments') || null;

  // Tier 3: Edge case scenarios
  if (lower.includes('confused')) return getScenario('confused-user') || null;
  if (lower.includes('error')) return getScenario('error-recovery') || null;
  if (lower.includes('support') && !lower.includes('ai')) return getScenario('support-escalation') || null;

  // Tier 4: Realistic user scenarios
  if (lower.includes('disney') || lower.includes('busy mom')) return getScenario('disney-busy-mom') || null;
  if (lower.includes('retiree') || lower.includes('alaska') || lower.includes('retirement')) return getScenario('retiree-alaska-cruise') || null;
  if (lower.includes('wedding') || lower.includes('bride') || lower.includes('tulum')) return getScenario('destination-wedding') || null;
  if (lower.includes('business') || lower.includes('singapore') || lower.includes('vietnam')) return getScenario('business-plus-leisure') || null;
  if (lower.includes('backpack') || lower.includes('gap year') || lower.includes('southeast asia')) return getScenario('gap-year-backpacker') || null;
  if (lower.includes('anniversary') || lower.includes('surprise') || lower.includes('napa')) return getScenario('surprise-anniversary') || null;
  if (lower.includes('reunion') || lower.includes('family reunion') || lower.includes('washington')) return getScenario('family-reunion-chaos') || null;
  if (lower.includes('solo') || lower.includes('portugal') || lower.includes('priya')) return getScenario('solo-female-traveler') || null;
  if (lower.includes('panic') || lower.includes('forgot') || lower.includes('last minute') || lower.includes('brandon')) return getScenario('last-minute-panic') || null;
  if (lower.includes('girls trip') || lower.includes('nashville') || lower.includes('bachelorette') || lower.includes('group trip')) return getScenario('group-trip-drama') || null;

  // Tier-based
  if (lower.includes('tier 1') || lower.includes('core')) return getScenariosByTier(1);
  if (lower.includes('tier 2') || lower.includes('feature')) return getScenariosByTier(2);
  if (lower.includes('tier 3') || lower.includes('edge')) return getScenariosByTier(3);
  if (lower.includes('tier 4') || lower.includes('realistic')) return getScenariosByTier(4);

  // All tests
  if (lower.includes('all')) return ALL_SCENARIOS;

  return null;
}

// =============================================================================
// ADMIN API HELPERS - For saving test results
// =============================================================================

/**
 * Save a test session result to the admin dashboard
 * MUST be called after every test to persist results
 */
export async function saveTestSessionToAdmin(
  session: TestSessionResult,
  adminKey: string,
  baseUrl: string = 'https://voygent.somotravel.workers.dev'
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/admin/test/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey
      },
      body: JSON.stringify(session)
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    const result = await response.json() as { success: boolean; sessionId?: string };
    return { success: result.success };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Save a test run summary to the admin dashboard
 */
export async function saveTestRunToAdmin(
  run: TestRunSummary,
  adminKey: string,
  baseUrl: string = 'https://voygent.somotravel.workers.dev'
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/admin/test/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': adminKey
      },
      body: JSON.stringify(run)
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }

    const result = await response.json() as { success: boolean; runId?: string };
    return { success: result.success };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Generate a unique session ID
 */
export function generateTestSessionId(scenarioId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `session-${scenarioId}-${timestamp}-${random}`;
}

// =============================================================================
// EXPORTS FOR USE IN TEST AGENTS
// =============================================================================

export {
  ALL_SCENARIOS,
  getScenario,
  getScenariosByTier,
  getCoreScenarios,
  createSession,
  callTool,
  listTools,
  getSessionSummary,
  formatTranscript,
  buildTestAgentPrompt,
  JUDGE_SYSTEM_PROMPT,
  buildJudgePrompt,
  buildSessionResult,
  buildRunSummary,
  parseJudgeOutput
};

export type {
  TestScenario,
  McpSession,
  TestConfig,
  TestSessionResult,
  TestRunSummary,
  JudgeResult
};
