/**
 * Admin Routes: Test Results Dashboard
 * Handles: GET /admin/test/runs, GET /admin/test/sessions, GET /admin/test/session/:id
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
        previewUrl: session.previewUrl
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
    }))
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
