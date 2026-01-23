/**
 * Voygent Test Runner - Module Exports
 *
 * This module provides automated QA testing for Voygent using Claude Code subagents.
 *
 * TWO TEST MODES:
 *
 * 1. CONVERSATIONAL TEST (Recommended)
 *    Simulates real Claude.ai sessions with natural user-assistant dialogue.
 *    Use: conversation-test.ts exports
 *
 * 2. DIRECT API TEST (Legacy)
 *    Makes direct MCP API calls without conversation simulation.
 *    Use: mcp-client.ts exports
 */

// Scenarios (Legacy - hardcoded)
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

// Scenarios (AI-Driven - JSON config with dynamic variation)
export {
  loadScenariosConfig,
  getTemplate,
  resolveKeyword,
  listTemplates,
  getTemplatesByTier,
  getBuilderInstructions,
  getRandomTemplate,
  generateBuilderPrompt,
  KEYWORD_TO_TEMPLATE,
  type ScenarioTemplate,
  type ScenariosConfig,
  type GeneratedTestInstance
} from './scenarios-loader';

// Conversational Test Framework (RECOMMENDED)
export {
  buildUserAgentPrompt,
  buildAssistantAgentPrompt,
  CONVERSATION_TEST_INSTRUCTIONS,
  toAdminSession,
  type ConversationTurn,
  type ConversationTestResult,
  type TestSessionForAdmin
} from './conversation-test';

// MCP Client (for making actual HTTP calls)
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

// Legacy Prompts (for direct API testing)
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
  getMonthlyCostKey,
  getDailyCostKey,
  getTripCostKey,
  saveSessionResult,
  saveRunSummary,
  getSessionResult,
  getRunSummary,
  listRecentSessions,
  listRecentRuns,
  redactArgs,
  TEST_TTL_SECONDS,
  COST_TTL_SECONDS,
  type JudgeScores,
  type JudgeFinding,
  type ProposedFAQ,
  type JudgeResult,
  type TestSessionResult,
  type TestRunSummary,
  type VisualReview,
  type VisualReviewFinding,
  type SuggestedFix,
  type TokenUsage,
  type McpCallDetail,
  type ConversationTokens,
  type TestCostSummary,
  type TripCostSummary
} from './results';

// Cost Tracking
export {
  PRICING,
  CHARS_PER_TOKEN,
  estimateTokens,
  calculateCost,
  estimateCallCost,
  aggregateSessionCosts,
  buildMonthlySummary,
  createCallDetail,
  truncateArgsPreview,
  formatCost,
  formatTokenCount
} from './cost-tracking';

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
