/**
 * Voygent Test Runner - Module Exports
 *
 * This module provides automated QA testing for Voygent using Claude Code subagents.
 */

// Scenarios
export {
  ALL_SCENARIOS,
  SCENARIOS_BY_TIER,
  SCENARIOS_BY_ID,
  getScenario,
  getScenariosByTier,
  getCoreScenarios,
  type TestScenario,
  type TestPersona,
  type SuccessCriteria
} from './scenarios';

// MCP Client
export {
  createSession,
  callTool,
  listTools,
  getSessionSummary,
  formatTranscript,
  type McpSession,
  type McpToolCall,
  type McpToolResult
} from './mcp-client';

// Prompts
export {
  buildTestAgentPrompt,
  JUDGE_SYSTEM_PROMPT,
  buildJudgePrompt,
  DEFAULT_TEST_CONFIG,
  type TestConfig
} from './prompts';

// Results
export {
  generateSessionId,
  generateRunId,
  buildSessionResult,
  buildRunSummary,
  parseJudgeOutput,
  getSessionKey,
  getRunKey,
  getConfigKey,
  getAnalysisKey,
  saveSessionResult,
  saveRunSummary,
  getSessionResult,
  getRunSummary,
  listRecentSessions,
  listRecentRuns,
  type JudgeScores,
  type JudgeFinding,
  type ProposedFAQ,
  type JudgeResult,
  type TestSessionResult,
  type TestRunSummary
} from './results';

// Runner
export {
  TEST_AUTH_KEY,
  TEST_BASE_URL,
  TEST_RUNNER_INSTRUCTIONS,
  getScenarioForCommand,
  saveTestSessionToAdmin,
  saveTestRunToAdmin,
  generateTestSessionId,
  type TestRunConfig,
  type TestRunResult
} from './run';
