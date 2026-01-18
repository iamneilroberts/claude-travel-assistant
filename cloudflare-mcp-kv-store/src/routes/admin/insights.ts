/**
 * Admin Insights API
 * GET /admin/insights - Returns computed insights and recommendations
 */

import type { Env, RouteHandler } from '../../types';
import { computeInsights, getToolUsageSummary } from '../../lib/metrics';

export const handleInsights: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/insights' || request.method !== 'GET') {
    return null;
  }

  const [insights, weekSummary] = await Promise.all([
    computeInsights(env),
    getToolUsageSummary(env, 'week')
  ]);

  // Generate actionable recommendations
  const recommendations: Array<{
    type: 'warning' | 'info' | 'success';
    title: string;
    message: string;
    action?: string;
  }> = [];

  // At-risk users
  if (insights.atRiskUsers.length > 0) {
    recommendations.push({
      type: 'warning',
      title: 'User Engagement Alert',
      message: `${insights.atRiskUsers.length} user(s) haven't been active in 3+ days`,
      action: 'Consider sending a check-in message'
    });
  }

  // High error rate
  if (weekSummary.errorRate > 5) {
    recommendations.push({
      type: 'warning',
      title: 'Elevated Error Rate',
      message: `${Math.round(weekSummary.errorRate)}% of tool calls are failing`,
      action: 'Review error logs for patterns'
    });
  }

  // Underused features
  if (insights.underusedFeatures.length > 0) {
    const features = insights.underusedFeatures.slice(0, 3).map(f => formatToolName(f.tool));
    recommendations.push({
      type: 'info',
      title: 'Underused Features',
      message: `${features.join(', ')} have low adoption`,
      action: 'Consider user education or feature improvements'
    });
  }

  // Positive trends
  if (insights.trends.changePercent > 20) {
    recommendations.push({
      type: 'success',
      title: 'Growing Usage',
      message: `Activity up ${Math.round(insights.trends.changePercent)}% from yesterday`,
      action: 'Keep up the momentum!'
    });
  }

  // Format at-risk users for display
  const atRiskFormatted = insights.atRiskUsers.map(u => ({
    ...u,
    displayName: u.userName || u.userId.split('.')[0],
    lastSeenFormatted: formatRelativeTime(u.lastSeen)
  }));

  // Format user segments
  const segments = {
    power: {
      label: 'Power Users',
      description: '50+ calls this week',
      count: insights.userSegments.power.length,
      users: insights.userSegments.power.slice(0, 5)
    },
    regular: {
      label: 'Regular Users',
      description: '20-49 calls this week',
      count: insights.userSegments.regular.length,
      users: insights.userSegments.regular.slice(0, 5)
    },
    light: {
      label: 'Light Users',
      description: '5-19 calls this week',
      count: insights.userSegments.light.length,
      users: insights.userSegments.light.slice(0, 5)
    },
    dormant: {
      label: 'Dormant Users',
      description: '<5 calls this week',
      count: insights.userSegments.dormant.length,
      users: insights.userSegments.dormant.slice(0, 5)
    }
  };

  // Calculate health score (0-100)
  let healthScore = 100;
  if (insights.atRiskUsers.length > 0) healthScore -= Math.min(insights.atRiskUsers.length * 5, 20);
  if (weekSummary.errorRate > 5) healthScore -= Math.min(weekSummary.errorRate * 2, 20);
  if (insights.trends.changePercent < -20) healthScore -= 15;
  if (insights.userSegments.dormant.length > insights.userSegments.power.length) healthScore -= 10;
  healthScore = Math.max(0, healthScore);

  return new Response(JSON.stringify({
    healthScore: Math.round(healthScore),
    recommendations,
    atRiskUsers: atRiskFormatted,
    trends: {
      ...insights.trends,
      direction: insights.trends.changePercent > 0 ? 'up' : insights.trends.changePercent < 0 ? 'down' : 'flat',
      changeFormatted: `${insights.trends.changePercent >= 0 ? '+' : ''}${Math.round(insights.trends.changePercent)}%`
    },
    underusedFeatures: insights.underusedFeatures.map(f => ({
      ...f,
      displayName: formatToolName(f.tool),
      usageFormatted: `${Math.round(f.usagePercent * 10) / 10}%`
    })),
    userSegments: segments,
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
 * Format relative time
 */
function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (days > 0) {
    return `${days}d ${hours}h ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  return 'Just now';
}
