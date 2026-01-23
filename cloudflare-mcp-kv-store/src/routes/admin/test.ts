/**
 * Admin Routes: Test Results Dashboard
 * Handles: GET /admin/test/runs, GET /admin/test/sessions, GET /admin/test/session/:id
 *          GET /admin/test/costs, GET /admin/test/costs/:month
 */

import type { Env, RouteHandler } from '../../types';
import { listAllKeys } from '../../lib/kv';

// Types matching the test runner
interface JudgeScores {
  taskCompletion: number;
  uxQuality: number;
  dataQuality: number;
  errorHandling: number;
  overall: number;
}

// Token & Cost tracking types
interface TokenUsage {
  input: number;
  output: number;
  total: number;
  isEstimated: boolean;
}

interface McpCallDetail {
  seq: number;
  tool: string;
  argsPreview: string;
  argsSize: number;
  success: boolean;
  error?: string;
  responseSize: number;
  durationMs: number;
  tokens: { input: number; output: number };
  cost: number;
  timestamp: string;
}

interface ConversationTokens {
  mcp: {
    input: number;
    output: number;
    byTool: Record<string, { input: number; output: number; calls: number }>;
  };
  reasoning: {
    personaGeneration: number;
    tripPlanning: number;
    judgeAnalysis: number;
  };
  overhead: {
    systemPrompt: number;
    toolSchemas: number;
  };
  total: TokenUsage;
}

interface TestCostSummary {
  month: string;
  totalCost: number;
  totalSessions: number;
  tokenUsage: TokenUsage;
  avgCostPerSession: number;
  byScenario: Record<string, { cost: number; sessions: number }>;
  byTool: Record<string, { cost: number; calls: number; avgDuration: number }>;
  dailyBreakdown: Array<{ date: string; cost: number; sessions: number }>;
}

interface VisualReviewFinding {
  area: 'layout' | 'content' | 'media' | 'data';
  issue: string;
  severity: 'critical' | 'warning' | 'minor';
}

interface SuggestedFix {
  issue: string;
  fix: string;
  file?: string;
}

interface VisualReview {
  enabled: boolean;
  codexFindings: VisualReviewFinding[];
  screenshots?: string[];  // Descriptions of captured screenshots
  overallAssessment: 'pass' | 'issues_found' | 'fail';
  suggestedFixes: SuggestedFix[];
}

interface TestSessionResult {
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
  tripId?: string;  // The trip created during the test (for preview link)
  previewUrl?: string;  // Direct link to preview the trip created
  mcpCallCount: number;
  mcpSuccessCount: number;
  toolsUsed: string[];
  transcript: string;
  agentNotes?: string;  // Test agent's observations and summary
  visualReview?: VisualReview;  // Codex browser-use visual review (when +visual flag used)
  judgeResult?: {
    scenarioId: string;
    passed: boolean;
    scores: JudgeScores;
    findings: Array<{
      type: string;
      area: string;
      description: string;
      evidence: string;
    }>;
    proposedFAQs: Array<{
      question: string;
      suggestedAnswer: string;
      evidence: string;
    }>;
    summary: string;
  };
  // Token & Cost Tracking
  tokens?: ConversationTokens;
  costEstimate?: number;
  modelUsed?: string;
  mcpCallDetails?: McpCallDetail[];
  reasoning?: {
    persona: string;
    structure: string;
    judge: string;
  };
}

interface TestRunSummary {
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

/**
 * GET /admin/test/runs - List recent test runs
 */
export const handleListTestRuns: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/runs' || request.method !== 'GET') return null;

  const limit = parseInt(url.searchParams.get('limit') || '10');
  const keys = await listAllKeys(env, { prefix: '_test/runs/' });

  const runs: TestRunSummary[] = [];
  const sortedKeys = keys
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(0, Math.min(limit * 2, keys.length));

  for (const key of sortedKeys) {
    const run = await env.TRIPS.get(key.name, 'json') as TestRunSummary | null;
    if (run) {
      runs.push(run);
    }
    if (runs.length >= limit) break;
  }

  // Sort by completedAt descending
  runs.sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  return new Response(JSON.stringify({
    runs: runs.slice(0, limit),
    count: runs.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/test/sessions - List recent test sessions
 */
export const handleListTestSessions: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/sessions' || request.method !== 'GET') return null;

  const limit = parseInt(url.searchParams.get('limit') || '20');
  const scenarioFilter = url.searchParams.get('scenario');

  const keys = await listAllKeys(env, { prefix: '_test/sessions/' });

  const sessions: Array<{
    id: string;
    scenarioId: string;
    scenarioName: string;
    tier: number;
    passed?: boolean;
    overallScore?: number;
    completedAt: string;
    tripId?: string;
    previewUrl?: string;
    // Cost tracking fields
    costEstimate?: number;
    tokenCount?: number;
    mcpCallCount: number;
  }> = [];

  for (const key of keys) {
    const session = await env.TRIPS.get(key.name, 'json') as TestSessionResult | null;
    if (session) {
      if (scenarioFilter && session.scenarioId !== scenarioFilter) continue;

      sessions.push({
        id: session.id,
        scenarioId: session.scenarioId,
        scenarioName: session.scenarioName,
        tier: session.tier,
        passed: session.judgeResult?.passed,
        overallScore: session.judgeResult?.scores.overall,
        completedAt: session.completedAt,
        tripId: session.tripId,
        previewUrl: session.previewUrl,
        // Cost tracking
        costEstimate: session.costEstimate,
        tokenCount: session.tokens?.total?.total,
        mcpCallCount: session.mcpCallCount
      });
    }
    if (sessions.length >= limit * 2) break;
  }

  // Sort by completedAt descending and take limit
  sessions.sort((a, b) => b.completedAt.localeCompare(a.completedAt));

  return new Response(JSON.stringify({
    sessions: sessions.slice(0, limit),
    count: sessions.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/test/session/:id - Get full test session details
 */
export const handleGetTestSession: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/test\/session\/([^/]+)$/);
  if (!match || request.method !== 'GET') return null;

  const sessionId = match[1];
  const session = await env.TRIPS.get(`_test/sessions/${sessionId}`, 'json') as TestSessionResult | null;

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(session), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/test/run/:id - Get full test run details
 */
export const handleGetTestRun: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/test\/run\/([^/]+)$/);
  if (!match || request.method !== 'GET') return null;

  const runId = match[1];
  const run = await env.TRIPS.get(`_test/runs/${runId}`, 'json') as TestRunSummary | null;

  if (!run) {
    return new Response(JSON.stringify({ error: 'Run not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify(run), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/test/stats - Get aggregate test statistics
 */
export const handleTestStats: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/stats' || request.method !== 'GET') return null;

  // Get recent runs for statistics
  const runKeys = await listAllKeys(env, { prefix: '_test/runs/' });
  const sessionKeys = await listAllKeys(env, { prefix: '_test/sessions/' });

  // Calculate stats from recent runs
  const recentRuns: TestRunSummary[] = [];
  const sortedRunKeys = runKeys.sort((a, b) => b.name.localeCompare(a.name)).slice(0, 10);

  for (const key of sortedRunKeys) {
    const run = await env.TRIPS.get(key.name, 'json') as TestRunSummary | null;
    if (run) recentRuns.push(run);
  }

  // Aggregate scores across runs
  const allScores = recentRuns.flatMap(r => r.aggregateScores);
  const avgScore = (field: keyof JudgeScores) => {
    const values = recentRuns.map(r => r.aggregateScores[field]).filter(v => v > 0);
    return values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  };

  const totalPassed = recentRuns.reduce((sum, r) => sum + r.passCount, 0);
  const totalFailed = recentRuns.reduce((sum, r) => sum + r.failCount, 0);

  // Calculate cost stats from recent sessions
  const recentSessions: TestSessionResult[] = [];
  const sortedSessionKeys = sessionKeys.sort((a, b) => b.name.localeCompare(a.name)).slice(0, 50);
  for (const key of sortedSessionKeys) {
    const session = await env.TRIPS.get(key.name, 'json') as TestSessionResult | null;
    if (session) recentSessions.push(session);
  }

  // Aggregate costs
  const currentMonth = new Date().toISOString().substring(0, 7);
  const sessionsThisMonth = recentSessions.filter(s => s.completedAt?.startsWith(currentMonth));
  const monthlyTotalCost = sessionsThisMonth.reduce((sum, s) => sum + (s.costEstimate || 0), 0);
  const monthlyTotalTokens = sessionsThisMonth.reduce((sum, s) => sum + (s.tokens?.total?.total || 0), 0);
  const avgCostPerSession = sessionsThisMonth.length > 0 ? monthlyTotalCost / sessionsThisMonth.length : 0;

  return new Response(JSON.stringify({
    totalRuns: runKeys.length,
    totalSessions: sessionKeys.length,
    recentRuns: recentRuns.length,
    passRate: totalPassed + totalFailed > 0
      ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100)
      : 0,
    averageScores: {
      taskCompletion: avgScore('taskCompletion'),
      uxQuality: avgScore('uxQuality'),
      dataQuality: avgScore('dataQuality'),
      errorHandling: avgScore('errorHandling'),
      overall: avgScore('overall')
    },
    trend: recentRuns.slice(0, 5).map(r => ({
      id: r.id,
      completedAt: r.completedAt,
      passRate: Math.round((r.passCount / (r.passCount + r.failCount)) * 100),
      overall: r.aggregateScores.overall
    })),
    // Cost tracking stats
    costs: {
      currentMonth,
      monthlyTotalCost,
      monthlyTotalTokens,
      avgCostPerSession,
      sessionsThisMonth: sessionsThisMonth.length
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/test/proposed-faqs - Get proposed FAQs from test findings
 */
export const handleProposedFAQs: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/proposed-faqs' || request.method !== 'GET') return null;

  const keys = await listAllKeys(env, { prefix: '_test/sessions/' });

  const faqs: Array<{
    question: string;
    suggestedAnswer: string;
    evidence: string;
    sourceSession: string;
    sourceScenario: string;
  }> = [];

  // Check recent sessions for proposed FAQs
  const sortedKeys = keys.sort((a, b) => b.name.localeCompare(a.name)).slice(0, 50);

  for (const key of sortedKeys) {
    const session = await env.TRIPS.get(key.name, 'json') as TestSessionResult | null;
    if (session?.judgeResult?.proposedFAQs) {
      for (const faq of session.judgeResult.proposedFAQs) {
        faqs.push({
          ...faq,
          sourceSession: session.id,
          sourceScenario: session.scenarioId
        });
      }
    }
  }

  return new Response(JSON.stringify({
    faqs,
    count: faqs.length
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * POST /admin/test/sessions - Save a test session result
 */
export const handleSaveTestSession: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/sessions' || request.method !== 'POST') return null;

  const session = await request.json() as TestSessionResult;

  // Validate required fields
  if (!session.id || !session.scenarioId || !session.scenarioName) {
    return new Response(JSON.stringify({ error: 'Missing required fields: id, scenarioId, scenarioName' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Ensure timestamps
  if (!session.startedAt) session.startedAt = new Date().toISOString();
  if (!session.completedAt) session.completedAt = new Date().toISOString();

  // Save with 7-day TTL
  const TTL = 7 * 24 * 60 * 60;
  await env.TRIPS.put(`_test/sessions/${session.id}`, JSON.stringify(session), {
    expirationTtl: TTL
  });

  return new Response(JSON.stringify({
    success: true,
    sessionId: session.id,
    message: 'Test session saved'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * POST /admin/test/runs - Save a test run summary
 */
export const handleSaveTestRun: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/runs' || request.method !== 'POST') return null;

  const run = await request.json() as TestRunSummary;

  // Validate required fields
  if (!run.id || !run.scenariosRun || !Array.isArray(run.results)) {
    return new Response(JSON.stringify({ error: 'Missing required fields: id, scenariosRun, results' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Ensure timestamps
  if (!run.startedAt) run.startedAt = new Date().toISOString();
  if (!run.completedAt) run.completedAt = new Date().toISOString();

  // Save with 7-day TTL
  const TTL = 7 * 24 * 60 * 60;
  await env.TRIPS.put(`_test/runs/${run.id}`, JSON.stringify(run), {
    expirationTtl: TTL
  });

  return new Response(JSON.stringify({
    success: true,
    runId: run.id,
    message: 'Test run saved'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * DELETE /admin/test/cleanup - Clean up old test data manually
 */
export const handleTestCleanup: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/cleanup' || request.method !== 'DELETE') return null;

  // List all test keys
  const sessionKeys = await listAllKeys(env, { prefix: '_test/sessions/' });
  const runKeys = await listAllKeys(env, { prefix: '_test/runs/' });

  // Delete all (normally TTL handles this, but manual cleanup available)
  let deletedCount = 0;

  for (const key of [...sessionKeys, ...runKeys]) {
    await env.TRIPS.delete(key.name);
    deletedCount++;
  }

  return new Response(JSON.stringify({
    success: true,
    deletedCount,
    message: `Deleted ${deletedCount} test records`
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * POST /admin/test/faq/approve - Approve a proposed FAQ and add to knowledge base
 */
export const handleApproveFAQ: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/faq/approve' || request.method !== 'POST') return null;

  const body = await request.json() as { sessionId: string; faqIndex: number };
  const { sessionId, faqIndex } = body;

  if (!sessionId || faqIndex === undefined) {
    return new Response(JSON.stringify({ error: 'Missing sessionId or faqIndex' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get the session
  const session = await env.TRIPS.get(`_test/sessions/${sessionId}`, 'json') as TestSessionResult | null;
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const faqs = session.judgeResult?.proposedFAQs;
  if (!faqs || !faqs[faqIndex]) {
    return new Response(JSON.stringify({ error: 'FAQ not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const faq = faqs[faqIndex];

  // Add to knowledge base (pending proposals)
  const proposalId = `test-faq-${Date.now()}`;
  const proposal = {
    id: proposalId,
    type: 'faq',
    question: faq.question,
    answer: faq.suggestedAnswer,
    source: `QA Test: ${session.scenarioId}`,
    evidence: faq.evidence,
    status: 'approved',
    createdAt: new Date().toISOString(),
    approvedAt: new Date().toISOString()
  };

  await env.TRIPS.put(`_knowledge/approved/${proposalId}`, JSON.stringify(proposal));

  // Remove the FAQ from the session
  faqs.splice(faqIndex, 1);
  await env.TRIPS.put(`_test/sessions/${sessionId}`, JSON.stringify(session));

  return new Response(JSON.stringify({
    success: true,
    message: 'FAQ added to knowledge base',
    proposalId
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * POST /admin/test/faq/dismiss - Dismiss a proposed FAQ
 */
export const handleDismissFAQ: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/faq/dismiss' || request.method !== 'POST') return null;

  const body = await request.json() as { sessionId: string; faqIndex: number };
  const { sessionId, faqIndex } = body;

  if (!sessionId || faqIndex === undefined) {
    return new Response(JSON.stringify({ error: 'Missing sessionId or faqIndex' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get the session
  const session = await env.TRIPS.get(`_test/sessions/${sessionId}`, 'json') as TestSessionResult | null;
  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const faqs = session.judgeResult?.proposedFAQs;
  if (!faqs || !faqs[faqIndex]) {
    return new Response(JSON.stringify({ error: 'FAQ not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Remove the FAQ from the session
  faqs.splice(faqIndex, 1);
  await env.TRIPS.put(`_test/sessions/${sessionId}`, JSON.stringify(session));

  return new Response(JSON.stringify({
    success: true,
    message: 'FAQ dismissed'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

// =============================================================================
// COST TRACKING ENDPOINTS
// =============================================================================

/**
 * GET /admin/test/costs - Get monthly cost summary
 */
export const handleGetCosts: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/costs' || request.method !== 'GET') return null;

  const month = url.searchParams.get('month') || new Date().toISOString().substring(0, 7);

  // Check for cached monthly summary
  const cachedSummary = await env.TRIPS.get(`_test/costs/${month}`, 'json') as TestCostSummary | null;
  if (cachedSummary) {
    return new Response(JSON.stringify(cachedSummary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Build summary from sessions
  const sessionKeys = await listAllKeys(env, { prefix: '_test/sessions/' });
  const sessions: TestSessionResult[] = [];

  for (const key of sessionKeys) {
    const session = await env.TRIPS.get(key.name, 'json') as TestSessionResult | null;
    if (session && session.completedAt?.startsWith(month)) {
      sessions.push(session);
    }
  }

  // Build cost summary
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  const byScenario: Record<string, { cost: number; sessions: number }> = {};
  const byTool: Record<string, { cost: number; calls: number; totalDuration: number }> = {};
  const dailyMap: Record<string, { cost: number; sessions: number }> = {};

  for (const session of sessions) {
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

  const summary: TestCostSummary = {
    month,
    totalCost,
    totalSessions: sessions.length,
    tokenUsage: {
      input: totalInput,
      output: totalOutput,
      total: totalInput + totalOutput,
      isEstimated: true,
    },
    avgCostPerSession: sessions.length > 0 ? totalCost / sessions.length : 0,
    byScenario,
    byTool: byToolWithAvg,
    dailyBreakdown,
  };

  // Cache the summary (30 day TTL)
  const COST_TTL = 30 * 24 * 60 * 60;
  await env.TRIPS.put(`_test/costs/${month}`, JSON.stringify(summary), {
    expirationTtl: COST_TTL
  });

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/test/session/:id/calls - Get detailed call breakdown for a session
 */
export const handleGetSessionCalls: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  const match = url.pathname.match(/^\/admin\/test\/session\/([^/]+)\/calls$/);
  if (!match || request.method !== 'GET') return null;

  const sessionId = match[1];
  const session = await env.TRIPS.get(`_test/sessions/${sessionId}`, 'json') as TestSessionResult | null;

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    sessionId: session.id,
    scenarioId: session.scenarioId,
    totalCost: session.costEstimate || 0,
    tokenUsage: session.tokens?.total || { input: 0, output: 0, total: 0, isEstimated: true },
    modelUsed: session.modelUsed || 'unknown',
    calls: session.mcpCallDetails || [],
    reasoning: session.reasoning
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * GET /admin/test/costs/by-tool - Get cost breakdown by tool across all sessions
 */
export const handleGetCostsByTool: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/test/costs/by-tool' || request.method !== 'GET') return null;

  const days = parseInt(url.searchParams.get('days') || '30');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString();

  const sessionKeys = await listAllKeys(env, { prefix: '_test/sessions/' });
  const byTool: Record<string, {
    cost: number;
    calls: number;
    totalDuration: number;
    successCount: number;
    errorCount: number;
    avgInputTokens: number;
    avgOutputTokens: number;
  }> = {};

  for (const key of sessionKeys) {
    const session = await env.TRIPS.get(key.name, 'json') as TestSessionResult | null;
    if (!session || !session.completedAt || session.completedAt < cutoffStr) continue;

    if (session.mcpCallDetails) {
      for (const call of session.mcpCallDetails) {
        if (!byTool[call.tool]) {
          byTool[call.tool] = {
            cost: 0,
            calls: 0,
            totalDuration: 0,
            successCount: 0,
            errorCount: 0,
            avgInputTokens: 0,
            avgOutputTokens: 0,
          };
        }
        byTool[call.tool].cost += call.cost;
        byTool[call.tool].calls += 1;
        byTool[call.tool].totalDuration += call.durationMs;
        if (call.success) {
          byTool[call.tool].successCount += 1;
        } else {
          byTool[call.tool].errorCount += 1;
        }
        byTool[call.tool].avgInputTokens += call.tokens.input;
        byTool[call.tool].avgOutputTokens += call.tokens.output;
      }
    }
  }

  // Calculate averages
  const result = Object.entries(byTool).map(([tool, data]) => ({
    tool,
    cost: data.cost,
    calls: data.calls,
    avgDuration: data.calls > 0 ? Math.round(data.totalDuration / data.calls) : 0,
    successRate: data.calls > 0 ? Math.round((data.successCount / data.calls) * 100) : 0,
    avgInputTokens: data.calls > 0 ? Math.round(data.avgInputTokens / data.calls) : 0,
    avgOutputTokens: data.calls > 0 ? Math.round(data.avgOutputTokens / data.calls) : 0,
    avgCostPerCall: data.calls > 0 ? data.cost / data.calls : 0,
  })).sort((a, b) => b.cost - a.cost);

  return new Response(JSON.stringify({
    days,
    tools: result,
    totalCost: result.reduce((sum, t) => sum + t.cost, 0),
    totalCalls: result.reduce((sum, t) => sum + t.calls, 0)
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};
