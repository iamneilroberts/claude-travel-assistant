/**
 * Admin Metrics Summary API
 * GET /admin/metrics-summary - Returns aggregated stats for a period
 */

import type { Env, RouteHandler } from '../../types';
import { getToolUsageSummary, getDailyMetrics } from '../../lib/metrics';

export const handleMetricsSummary: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/metrics-summary' || request.method !== 'GET') {
    return null;
  }

  const period = (url.searchParams.get('period') || 'day') as 'day' | 'week' | 'month';

  const summary = await getToolUsageSummary(env, period);

  // Get today's metrics for recent activity
  const today = new Date().toISOString().split('T')[0];
  const todayMetrics = await getDailyMetrics(env, today);

  // Format tools for display
  const toolStats = Object.entries(summary.tools)
    .map(([name, stats]) => ({
      name,
      displayName: formatToolName(name),
      ...stats,
      successRate: Math.round(stats.successRate * 10) / 10,
      category: categorize(name)
    }))
    .sort((a, b) => b.count - a.count);

  // Group by category
  const byCategory: Record<string, typeof toolStats> = {};
  for (const tool of toolStats) {
    if (!byCategory[tool.category]) {
      byCategory[tool.category] = [];
    }
    byCategory[tool.category].push(tool);
  }

  // Calculate performance metrics
  const avgDuration = toolStats.length > 0
    ? Math.round(toolStats.reduce((sum, t) => sum + t.avgDurationMs * t.count, 0) / summary.totalCalls)
    : 0;

  const p95Duration = toolStats.length > 0
    ? Math.max(...toolStats.map(t => t.p95DurationMs))
    : 0;

  // Format peak hour
  const peakHourFormatted = summary.peakHour.hour
    ? `${summary.peakHour.hour}:00 - ${String(parseInt(summary.peakHour.hour) + 1).padStart(2, '0')}:00`
    : 'N/A';

  return new Response(JSON.stringify({
    period: summary.period,
    overview: {
      totalCalls: summary.totalCalls,
      uniqueUsers: summary.uniqueUsers,
      errorRate: Math.round(summary.errorRate * 10) / 10,
      avgDurationMs: avgDuration,
      p95DurationMs: p95Duration,
      peakHour: peakHourFormatted,
      peakHourCount: summary.peakHour.count
    },
    tools: toolStats,
    toolsByCategory: byCategory,
    topUsers: summary.topUsers.map(u => ({
      ...u,
      displayName: u.userName || u.userId.split('.')[0]
    })),
    hourlyDistribution: todayMetrics?.hourlyBreakdown || {},
    serverTime: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * Format tool name for display
 */
function formatToolName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Categorize tools by function
 */
function categorize(name: string): string {
  const categories: Record<string, string[]> = {
    'Trip Management': ['list_trips', 'read_trip', 'read_trip_section', 'save_trip', 'patch_trip', 'delete_trip'],
    'Publishing': ['list_templates', 'preview_publish', 'publish_trip'],
    'Analysis': ['validate_trip', 'import_quote', 'analyze_profitability'],
    'Comments': ['get_comments', 'get_all_comments', 'dismiss_comments'],
    'Support': ['submit_support', 'reply_to_admin', 'dismiss_admin_message'],
    'Media': ['add_trip_image', 'prepare_image_upload', 'youtube_search'],
    'Session': ['get_context', 'get_prompt']
  };

  for (const [category, tools] of Object.entries(categories)) {
    if (tools.includes(name)) {
      return category;
    }
  }

  return 'Other';
}
