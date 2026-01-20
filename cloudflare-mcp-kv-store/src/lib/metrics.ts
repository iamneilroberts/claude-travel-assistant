/**
 * Tool Call Metrics - Track and aggregate MCP tool usage
 *
 * Stores:
 * - _metrics/realtime: Rolling buffer of last 200 calls
 * - _metrics/tools/{YYYY-MM-DD}: Daily aggregates (30-day TTL)
 */

import type { Env } from '../types';

// ============ Types ============

export interface ToolCallMetric {
  id: string;
  timestamp: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  tool: string;
  durationMs: number;
  responseBytes?: number;  // Size of JSON response in bytes
  success: boolean;
  errorType?: string;
  metadata?: {
    tripId?: string;
    fieldsChanged?: string[];
    templateName?: string;
    [key: string]: any;
  };
}

export interface ToolStats {
  count: number;
  successCount: number;
  errorCount: number;
  totalDurationMs: number;
  avgDurationMs: number;
  durations: number[];  // For percentile calculations
  errors: Record<string, number>;  // Error type counts
  // Response size tracking
  totalBytes: number;
  avgBytes: number;
  maxBytes: number;
  responseSizes: number[];  // For percentile calculations
}

export interface HourlyStats {
  count: number;
  uniqueUsers: string[];
}

export interface DailyToolMetrics {
  date: string;
  tools: Record<string, ToolStats>;
  hourlyBreakdown: Record<string, HourlyStats>;  // "00" - "23"
  uniqueUsers: string[];
  totalCalls: number;
}

export interface RealtimeMetrics {
  calls: ToolCallMetric[];
  lastUpdated: string;
}

export interface ToolUsageSummary {
  period: { start: string; end: string };
  totalCalls: number;
  uniqueUsers: number;
  tools: Record<string, {
    count: number;
    successRate: number;
    avgDurationMs: number;
    p95DurationMs: number;
    avgBytes: number;
    maxBytes: number;
    p95Bytes: number;
  }>;
  peakHour: { hour: string; count: number };
  topUsers: Array<{ userId: string; userName?: string; count: number }>;
  errorRate: number;
}

// ============ Constants ============

const REALTIME_KEY = '_metrics/realtime';
const DAILY_KEY_PREFIX = '_metrics/tools/';
const MAX_REALTIME_CALLS = 200;
const DAILY_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// ============ Core Functions ============

/**
 * Record a tool call metric
 * Uses waitUntil for non-blocking KV writes
 */
export async function recordToolCall(
  env: Env,
  metric: Omit<ToolCallMetric, 'id' | 'timestamp'>,
  ctx?: ExecutionContext
): Promise<void> {
  const fullMetric: ToolCallMetric = {
    ...metric,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString()
  };

  const write = async () => {
    try {
      // Update realtime buffer
      await updateRealtimeBuffer(env, fullMetric);

      // Update daily aggregates
      await updateDailyAggregates(env, fullMetric);
    } catch (err) {
      console.error('Failed to record metric:', err);
    }
  };

  if (ctx) {
    ctx.waitUntil(write());
  } else {
    await write();
  }
}

/**
 * Update the realtime rolling buffer
 */
async function updateRealtimeBuffer(env: Env, metric: ToolCallMetric): Promise<void> {
  const existing = await env.TRIPS.get(REALTIME_KEY, 'json') as RealtimeMetrics | null;
  const calls = existing?.calls || [];

  // Add new call at beginning
  calls.unshift(metric);

  // Trim to max size
  const trimmed = calls.slice(0, MAX_REALTIME_CALLS);

  await env.TRIPS.put(REALTIME_KEY, JSON.stringify({
    calls: trimmed,
    lastUpdated: new Date().toISOString()
  }));
}

/**
 * Update daily aggregate metrics
 */
async function updateDailyAggregates(env: Env, metric: ToolCallMetric): Promise<void> {
  const date = metric.timestamp.split('T')[0];  // YYYY-MM-DD
  const hour = metric.timestamp.split('T')[1].substring(0, 2);  // "00" - "23"
  const key = `${DAILY_KEY_PREFIX}${date}`;

  const existing = await env.TRIPS.get(key, 'json') as DailyToolMetrics | null;
  const daily: DailyToolMetrics = existing || {
    date,
    tools: {},
    hourlyBreakdown: {},
    uniqueUsers: [],
    totalCalls: 0
  };

  // Update tool stats
  if (!daily.tools[metric.tool]) {
    daily.tools[metric.tool] = {
      count: 0,
      successCount: 0,
      errorCount: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
      durations: [],
      errors: {},
      // Response size tracking
      totalBytes: 0,
      avgBytes: 0,
      maxBytes: 0,
      responseSizes: []
    };
  }

  const toolStats = daily.tools[metric.tool];
  toolStats.count++;
  toolStats.totalDurationMs += metric.durationMs;
  toolStats.avgDurationMs = toolStats.totalDurationMs / toolStats.count;

  // Keep only last 100 durations for percentile calcs
  toolStats.durations.push(metric.durationMs);
  if (toolStats.durations.length > 100) {
    toolStats.durations = toolStats.durations.slice(-100);
  }

  // Track response size if available
  if (metric.responseBytes !== undefined) {
    toolStats.totalBytes += metric.responseBytes;
    toolStats.avgBytes = toolStats.totalBytes / toolStats.count;
    toolStats.maxBytes = Math.max(toolStats.maxBytes, metric.responseBytes);

    // Keep only last 100 sizes for percentile calcs
    toolStats.responseSizes.push(metric.responseBytes);
    if (toolStats.responseSizes.length > 100) {
      toolStats.responseSizes = toolStats.responseSizes.slice(-100);
    }
  }

  if (metric.success) {
    toolStats.successCount++;
  } else {
    toolStats.errorCount++;
    const errType = metric.errorType || 'unknown';
    toolStats.errors[errType] = (toolStats.errors[errType] || 0) + 1;
  }

  // Update hourly breakdown
  if (!daily.hourlyBreakdown[hour]) {
    daily.hourlyBreakdown[hour] = { count: 0, uniqueUsers: [] };
  }
  daily.hourlyBreakdown[hour].count++;
  if (!daily.hourlyBreakdown[hour].uniqueUsers.includes(metric.userId)) {
    daily.hourlyBreakdown[hour].uniqueUsers.push(metric.userId);
  }

  // Update unique users
  if (!daily.uniqueUsers.includes(metric.userId)) {
    daily.uniqueUsers.push(metric.userId);
  }

  daily.totalCalls++;

  await env.TRIPS.put(key, JSON.stringify(daily), {
    expirationTtl: DAILY_TTL_SECONDS
  });
}

// ============ Query Functions ============

/**
 * Get real-time call metrics
 */
export async function getRealtimeCalls(
  env: Env,
  options?: {
    limit?: number;
    since?: string;
    userId?: string;
    tool?: string;
  }
): Promise<ToolCallMetric[]> {
  const data = await env.TRIPS.get(REALTIME_KEY, 'json') as RealtimeMetrics | null;
  let calls = data?.calls || [];

  // Filter by since timestamp
  if (options?.since) {
    const sinceTime = new Date(options.since).getTime();
    calls = calls.filter(c => new Date(c.timestamp).getTime() > sinceTime);
  }

  // Filter by userId
  if (options?.userId) {
    calls = calls.filter(c => c.userId === options.userId);
  }

  // Filter by tool
  if (options?.tool) {
    calls = calls.filter(c => c.tool === options.tool);
  }

  // Apply limit
  if (options?.limit) {
    calls = calls.slice(0, options.limit);
  }

  return calls;
}

/**
 * Get daily metrics for a specific date
 */
export async function getDailyMetrics(env: Env, date: string): Promise<DailyToolMetrics | null> {
  const key = `${DAILY_KEY_PREFIX}${date}`;
  return await env.TRIPS.get(key, 'json') as DailyToolMetrics | null;
}

/**
 * Get metrics for a date range
 */
export async function getMetricsRange(
  env: Env,
  startDate: string,
  endDate: string
): Promise<DailyToolMetrics[]> {
  const results: DailyToolMetrics[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const daily = await getDailyMetrics(env, dateStr);
    if (daily) {
      results.push(daily);
    }
  }

  return results;
}

/**
 * Get aggregated tool usage summary
 */
export async function getToolUsageSummary(
  env: Env,
  period: 'day' | 'week' | 'month' = 'day'
): Promise<ToolUsageSummary> {
  const now = new Date();
  let startDate: string;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    default:
      startDate = now.toISOString().split('T')[0];
  }

  const endDate = now.toISOString().split('T')[0];
  const dailyMetrics = await getMetricsRange(env, startDate, endDate);

  // Aggregate data
  const tools: Record<string, {
    count: number;
    successCount: number;
    totalMs: number;
    durations: number[];
    totalBytes: number;
    maxBytes: number;
    responseSizes: number[];
  }> = {};
  const userCounts: Record<string, { count: number; name?: string }> = {};
  const hourCounts: Record<string, number> = {};
  let totalCalls = 0;
  let totalErrors = 0;
  const allUsers = new Set<string>();

  for (const daily of dailyMetrics) {
    totalCalls += daily.totalCalls;
    daily.uniqueUsers.forEach(u => allUsers.add(u));

    // Aggregate tool stats
    for (const [tool, stats] of Object.entries(daily.tools)) {
      if (!tools[tool]) {
        tools[tool] = {
          count: 0,
          successCount: 0,
          totalMs: 0,
          durations: [],
          totalBytes: 0,
          maxBytes: 0,
          responseSizes: []
        };
      }
      tools[tool].count += stats.count;
      tools[tool].successCount += stats.successCount;
      tools[tool].totalMs += stats.totalDurationMs;
      tools[tool].durations.push(...stats.durations);
      totalErrors += stats.errorCount;

      // Aggregate response size stats (handle legacy data without these fields)
      tools[tool].totalBytes += stats.totalBytes || 0;
      tools[tool].maxBytes = Math.max(tools[tool].maxBytes, stats.maxBytes || 0);
      if (stats.responseSizes) {
        tools[tool].responseSizes.push(...stats.responseSizes);
      }
    }

    // Aggregate hourly
    for (const [hour, stats] of Object.entries(daily.hourlyBreakdown)) {
      hourCounts[hour] = (hourCounts[hour] || 0) + stats.count;
    }
  }

  // Get user activity from realtime calls for user names
  const realtimeCalls = await getRealtimeCalls(env, { limit: MAX_REALTIME_CALLS });
  for (const call of realtimeCalls) {
    if (!userCounts[call.userId]) {
      userCounts[call.userId] = { count: 0, name: call.userName };
    }
    userCounts[call.userId].count++;
  }

  // Calculate percentiles
  const calculateP95 = (durations: number[]): number => {
    if (durations.length === 0) return 0;
    const sorted = [...durations].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.95);
    return sorted[idx] || sorted[sorted.length - 1];
  };

  // Build tool summary
  const toolSummary: ToolUsageSummary['tools'] = {};
  for (const [tool, data] of Object.entries(tools)) {
    toolSummary[tool] = {
      count: data.count,
      successRate: data.count > 0 ? (data.successCount / data.count) * 100 : 0,
      avgDurationMs: data.count > 0 ? Math.round(data.totalMs / data.count) : 0,
      p95DurationMs: calculateP95(data.durations),
      avgBytes: data.count > 0 ? Math.round(data.totalBytes / data.count) : 0,
      maxBytes: data.maxBytes,
      p95Bytes: calculateP95(data.responseSizes)
    };
  }

  // Find peak hour
  let peakHour = { hour: '00', count: 0 };
  for (const [hour, count] of Object.entries(hourCounts)) {
    if (count > peakHour.count) {
      peakHour = { hour, count };
    }
  }

  // Top users
  const topUsers = Object.entries(userCounts)
    .map(([userId, data]) => ({ userId, userName: data.name, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    period: { start: startDate, end: endDate },
    totalCalls,
    uniqueUsers: allUsers.size,
    tools: toolSummary,
    peakHour,
    topUsers,
    errorRate: totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0
  };
}

/**
 * Get activity stream with age-based styling data
 */
export async function getActivityStream(
  env: Env,
  options?: { since?: string; limit?: number }
): Promise<Array<ToolCallMetric & { ageClass: string; ageSeconds: number }>> {
  const calls = await getRealtimeCalls(env, options);
  const now = Date.now();

  return calls.map(call => {
    const ageSeconds = Math.floor((now - new Date(call.timestamp).getTime()) / 1000);
    let ageClass: string;

    if (ageSeconds < 60) {
      ageClass = 'fresh';  // < 1 min: green, pulsing
    } else if (ageSeconds < 300) {
      ageClass = 'recent';  // 1-5 min: blue
    } else if (ageSeconds < 3600) {
      ageClass = 'stale';  // 5-60 min: gray 70%
    } else {
      ageClass = 'old';  // > 1 hour: gray 50%
    }

    return { ...call, ageClass, ageSeconds };
  });
}

/**
 * Compute insights from metrics
 */
type UserWithCount = { userId: string; displayName?: string; count: number };

export async function computeInsights(env: Env): Promise<{
  healthScore: number;
  atRiskUsers: Array<{ userId: string; userName?: string; lastSeen: string; daysSinceActive: number }>;
  underusedFeatures: Array<{ tool: string; usagePercent: number }>;
  trends: { callsToday: number; callsYesterday: number; changePercent: number };
  userSegments: { power: UserWithCount[]; regular: UserWithCount[]; light: UserWithCount[]; dormant: UserWithCount[] };
}> {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [todayMetrics, yesterdayMetrics, weekMetrics] = await Promise.all([
    getDailyMetrics(env, today),
    getDailyMetrics(env, yesterday),
    getMetricsRange(env, weekAgo, today)
  ]);

  // User activity tracking
  const userActivity: Record<string, { lastSeen: string; callCount: number; name?: string }> = {};
  const realtimeCalls = await getRealtimeCalls(env, { limit: MAX_REALTIME_CALLS });

  for (const call of realtimeCalls) {
    if (!userActivity[call.userId] || call.timestamp > userActivity[call.userId].lastSeen) {
      userActivity[call.userId] = {
        lastSeen: call.timestamp,
        callCount: (userActivity[call.userId]?.callCount || 0) + 1,
        name: call.userName
      };
    } else {
      userActivity[call.userId].callCount++;
    }
  }

  // At-risk users (not seen in 3+ days but were active)
  const now = Date.now();
  const atRiskUsers = Object.entries(userActivity)
    .map(([userId, data]) => ({
      userId,
      userName: data.name,
      lastSeen: data.lastSeen,
      daysSinceActive: Math.floor((now - new Date(data.lastSeen).getTime()) / (24 * 60 * 60 * 1000))
    }))
    .filter(u => u.daysSinceActive >= 3 && u.daysSinceActive < 14)
    .sort((a, b) => b.daysSinceActive - a.daysSinceActive);

  // Underused features (tools with < 5% of total calls)
  const totalCalls = weekMetrics.reduce((sum, d) => sum + d.totalCalls, 0);
  const toolCounts: Record<string, number> = {};
  for (const daily of weekMetrics) {
    for (const [tool, stats] of Object.entries(daily.tools)) {
      toolCounts[tool] = (toolCounts[tool] || 0) + stats.count;
    }
  }
  const underusedFeatures = Object.entries(toolCounts)
    .map(([tool, count]) => ({ tool, usagePercent: (count / totalCalls) * 100 }))
    .filter(t => t.usagePercent < 5)
    .sort((a, b) => a.usagePercent - b.usagePercent);

  // Trends
  const callsToday = todayMetrics?.totalCalls || 0;
  const callsYesterday = yesterdayMetrics?.totalCalls || 0;
  const changePercent = callsYesterday > 0
    ? ((callsToday - callsYesterday) / callsYesterday) * 100
    : 0;

  // User segments based on weekly activity (include call counts)
  const segments = {
    power: [] as UserWithCount[],
    regular: [] as UserWithCount[],
    light: [] as UserWithCount[],
    dormant: [] as UserWithCount[]
  };
  for (const [userId, data] of Object.entries(userActivity)) {
    const user: UserWithCount = { userId, displayName: data.name, count: data.callCount };
    if (data.callCount >= 50) {
      segments.power.push(user);
    } else if (data.callCount >= 20) {
      segments.regular.push(user);
    } else if (data.callCount >= 5) {
      segments.light.push(user);
    } else {
      segments.dormant.push(user);
    }
  }
  // Sort each segment by call count descending
  segments.power.sort((a, b) => b.count - a.count);
  segments.regular.sort((a, b) => b.count - a.count);
  segments.light.sort((a, b) => b.count - a.count);
  segments.dormant.sort((a, b) => b.count - a.count);

  // Calculate health score (0-100)
  let healthScore = 100;
  if (atRiskUsers.length > 0) healthScore -= Math.min(atRiskUsers.length * 5, 20);
  const weekErrorRate = weekMetrics.reduce((sum, d) => {
    const dayErrors = Object.values(d.tools).reduce((e, t) => e + t.errorCount, 0);
    return sum + dayErrors;
  }, 0) / Math.max(weekMetrics.reduce((sum, d) => sum + d.totalCalls, 0), 1) * 100;
  if (weekErrorRate > 5) healthScore -= Math.min(weekErrorRate * 2, 20);
  if (changePercent < -20) healthScore -= 15;
  if (segments.dormant.length > segments.power.length) healthScore -= 10;
  healthScore = Math.max(0, healthScore);

  return {
    healthScore,
    atRiskUsers,
    underusedFeatures,
    trends: { callsToday, callsYesterday, changePercent },
    userSegments: segments
  };
}

/**
 * Get response size benchmarks - which tools return the most data
 * Useful for identifying optimization targets
 */
export interface ResponseSizeBenchmark {
  tool: string;
  avgBytes: number;
  maxBytes: number;
  p95Bytes: number;
  callCount: number;
  // Rough token estimate (4 chars/token) for reference only
  estimatedAvgTokens: number;
  estimatedP95Tokens: number;
}

export async function getResponseSizeBenchmarks(
  env: Env,
  period: 'day' | 'week' | 'month' = 'week'
): Promise<{
  benchmarks: ResponseSizeBenchmark[];
  totalAvgBytesPerCall: number;
  largestTools: string[];  // Top 3 by avg bytes
  period: { start: string; end: string };
}> {
  const summary = await getToolUsageSummary(env, period);

  const benchmarks: ResponseSizeBenchmark[] = Object.entries(summary.tools)
    .map(([tool, stats]) => ({
      tool,
      avgBytes: stats.avgBytes,
      maxBytes: stats.maxBytes,
      p95Bytes: stats.p95Bytes,
      callCount: stats.count,
      // Rough token estimate - divide by 4 (not accurate, just directional)
      estimatedAvgTokens: Math.round(stats.avgBytes / 4),
      estimatedP95Tokens: Math.round(stats.p95Bytes / 4)
    }))
    .filter(b => b.avgBytes > 0)  // Exclude tools with no size data yet
    .sort((a, b) => b.avgBytes - a.avgBytes);

  // Calculate weighted average bytes per call
  const totalBytes = benchmarks.reduce((sum, b) => sum + (b.avgBytes * b.callCount), 0);
  const totalCalls = benchmarks.reduce((sum, b) => sum + b.callCount, 0);
  const totalAvgBytesPerCall = totalCalls > 0 ? Math.round(totalBytes / totalCalls) : 0;

  // Top 3 largest tools
  const largestTools = benchmarks.slice(0, 3).map(b => b.tool);

  return {
    benchmarks,
    totalAvgBytesPerCall,
    largestTools,
    period: summary.period
  };
}
