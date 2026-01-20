/**
 * Admin Activity Stream API
 * GET /admin/activity-stream - Returns real-time activity with age styling data
 */

import type { Env, RouteHandler } from '../../types';
import { getActivityStream, getDailyMetrics } from '../../lib/metrics';

export const handleActivityStream: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/activity-stream' || request.method !== 'GET') {
    return null;
  }

  const since = url.searchParams.get('since') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  // Get activities and daily metrics in parallel
  const today = new Date().toISOString().split('T')[0];
  const [activities, dailyMetrics] = await Promise.all([
    getActivityStream(env, { since, limit }),
    getDailyMetrics(env, today)
  ]);

  // Calculate P95 threshold from daily metrics
  const allDurations: number[] = [];
  if (dailyMetrics) {
    for (const stats of Object.values(dailyMetrics.tools)) {
      allDurations.push(...stats.durations);
    }
  }
  const p95Threshold = calculatePercentile(allDurations, 95);

  // Calculate error breakdown
  const errorBreakdown: Record<string, number> = {};
  const toolErrors: Record<string, number> = {};
  if (dailyMetrics) {
    for (const [tool, stats] of Object.entries(dailyMetrics.tools)) {
      for (const [errType, count] of Object.entries(stats.errors)) {
        errorBreakdown[errType] = (errorBreakdown[errType] || 0) + count;
      }
      if (stats.errorCount > 0) {
        toolErrors[tool] = stats.errorCount;
      }
    }
  }

  // Calculate tool distribution with response sizes
  const toolDistribution: Record<string, { count: number; successRate: number; avgMs: number; avgBytes: number }> = {};
  let totalBytes = 0;
  let totalByteCalls = 0;
  if (dailyMetrics) {
    for (const [tool, stats] of Object.entries(dailyMetrics.tools)) {
      toolDistribution[tool] = {
        count: stats.count,
        successRate: stats.count > 0 ? Math.round((stats.successCount / stats.count) * 100) : 100,
        avgMs: Math.round(stats.avgDurationMs),
        avgBytes: stats.avgBytes || 0
      };
      if (stats.avgBytes > 0) {
        totalBytes += stats.avgBytes * stats.count;
        totalByteCalls += stats.count;
      }
    }
  }
  const avgBytesPerCall = totalByteCalls > 0 ? Math.round(totalBytes / totalByteCalls) : 0;

  // Get top 5 heaviest tools by response size
  const heavyTools = Object.entries(toolDistribution)
    .filter(([_, data]) => data.avgBytes > 0)
    .sort((a, b) => b[1].avgBytes - a[1].avgBytes)
    .slice(0, 5)
    .map(([tool, data]) => ({ tool, avgBytes: data.avgBytes, count: data.count }));

  // Format for display with enhanced metadata
  const formatted = activities.map(activity => {
    const meta = activity.metadata || {};
    return {
      id: activity.id,
      timestamp: activity.timestamp,
      time: formatTime(activity.timestamp),
      user: activity.userName || activity.userId,
      userId: activity.userId,
      tool: activity.tool,
      action: formatToolAction(activity.tool),
      success: activity.success,
      status: activity.success ? 'OK' : 'ERR',
      durationMs: activity.durationMs,
      durationDisplay: activity.durationMs ? (activity.durationMs < 1000 ? activity.durationMs + 'ms' : (activity.durationMs / 1000).toFixed(1) + 's') : '-',
      isSlow: activity.durationMs > p95Threshold && p95Threshold > 0,
      tripId: meta.tripId,
      errorType: activity.errorType,
      ageClass: activity.ageClass,
      ageSeconds: activity.ageSeconds,
      ageDisplay: formatAge(activity.ageSeconds),
      // Human-readable detail string for inline display
      detail: formatActionDetail(activity.tool, meta, activity.errorType),
      // Full metadata for expandable view
      metadata: {
        section: meta.section,
        fieldsChanged: meta.fieldsChanged,
        changeCount: meta.changeCount,
        templateName: meta.templateName,
        category: meta.category,
        destination: meta.destination,
        clientName: meta.clientName,
        commentCount: meta.commentCount,
        searchQuery: meta.searchQuery,
        imageType: meta.imageType,
        validationType: meta.validationType,
        importSource: meta.importSource,
        priority: meta.priority,
        limit: meta.limit
      }
    };
  });

  // Get recent errors only
  const recentErrors = formatted.filter(a => !a.success).slice(0, 10);

  return new Response(JSON.stringify({
    activities: formatted,
    count: formatted.length,
    since,
    serverTime: new Date().toISOString(),
    // Live stats
    liveStats: {
      p95Threshold,
      errorBreakdown,
      toolErrors,
      toolDistribution,
      hourlyBreakdown: dailyMetrics?.hourlyBreakdown || {},
      totalCallsToday: dailyMetrics?.totalCalls || 0,
      uniqueUsersToday: dailyMetrics?.uniqueUsers?.length || 0,
      // Response size data
      avgBytesPerCall,
      heavyTools
    },
    recentErrors
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * Calculate percentile from an array of numbers
 */
function calculatePercentile(arr: number[], percentile: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * (percentile / 100));
  return sorted[Math.min(idx, sorted.length - 1)];
}

/**
 * Format timestamp for arrivals board display (h:MM AM/PM CST)
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Chicago'
  });
}

/**
 * Format tool name into readable action (short, title case)
 */
function formatToolAction(tool: string): string {
  const actions: Record<string, string> = {
    get_context: 'Session',
    list_trips: 'List',
    read_trip: 'Read',
    read_trip_section: 'Section',
    save_trip: 'Save',
    patch_trip: 'Update',
    delete_trip: 'Delete',
    list_templates: 'Templates',
    preview_publish: 'Preview',
    publish_trip: 'Publish',
    validate_trip: 'Validate',
    import_quote: 'Import',
    analyze_profitability: 'Analyze',
    get_prompt: 'Prompt',
    get_comments: 'Comments',
    get_all_comments: 'Comments',
    dismiss_comments: 'Dismiss',
    submit_support: 'Support',
    reply_to_admin: 'Reply',
    dismiss_admin_message: 'Dismiss',
    add_trip_image: 'Image',
    prepare_image_upload: 'Upload',
    youtube_search: 'YouTube',
    get_subscription: 'Subscribe'
  };

  // Return mapped action or format unknown tools nicely
  if (actions[tool]) return actions[tool];

  // Convert snake_case to Title Case for unknown tools
  return tool.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

/**
 * Format age in seconds to human readable
 */
function formatAge(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Generate human-readable detail string for each action type
 */
function formatActionDetail(tool: string, meta: Record<string, any>, errorType?: string): string {
  // If there's an error, show error type
  if (errorType) {
    return `Error: ${errorType.replace(/_/g, ' ')}`;
  }

  switch (tool) {
    case 'read_trip_section':
      return meta.section ? `Section: ${meta.section}` : '';

    case 'patch_trip':
      if (meta.fieldsChanged?.length) {
        const fields = meta.fieldsChanged.slice(0, 3).join(', ');
        const more = meta.fieldsChanged.length > 3 ? ` +${meta.fieldsChanged.length - 3}` : '';
        return `Changed: ${fields}${more}`;
      }
      return '';

    case 'save_trip':
      if (meta.destination || meta.clientName) {
        const parts = [];
        if (meta.clientName) parts.push(meta.clientName);
        if (meta.destination) parts.push(meta.destination);
        return parts.join(' → ');
      }
      return '';

    case 'preview_publish':
    case 'publish_trip':
      const pubParts = [];
      if (meta.templateName && meta.templateName !== 'default') {
        pubParts.push(`Template: ${meta.templateName}`);
      }
      if (meta.category) {
        pubParts.push(`Category: ${meta.category}`);
      }
      return pubParts.join(', ');

    case 'dismiss_comments':
      return meta.commentCount ? `${meta.commentCount} comment${meta.commentCount > 1 ? 's' : ''}` : '';

    case 'youtube_search':
      return meta.searchQuery ? `"${meta.searchQuery}"` : '';

    case 'add_trip_image':
      return meta.imageType ? `Source: ${meta.imageType}` : '';

    case 'validate_trip':
      return meta.validationType ? `Scope: ${meta.validationType}` : '';

    case 'import_quote':
      return meta.importSource ? `From: ${meta.importSource}` : '';

    case 'submit_support':
      const supportParts = [];
      if (meta.category) supportParts.push(meta.category);
      if (meta.priority) supportParts.push(`[${meta.priority}]`);
      return supportParts.join(' ');

    case 'list_trips':
      return '';

    case 'list_templates':
      return '';

    case 'get_context':
      return 'New conversation';

    case 'get_prompt':
      return meta.promptName ? meta.promptName : '';

    case 'get_subscription':
      return '';

    default:
      return '';
  }
}
