/**
 * Admin Activity Stream API
 * GET /admin/activity-stream - Returns real-time activity with age styling data
 */

import type { Env, RouteHandler } from '../../types';
import { getActivityStream } from '../../lib/metrics';

export const handleActivityStream: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== '/admin/activity-stream' || request.method !== 'GET') {
    return null;
  }

  const since = url.searchParams.get('since') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  const activities = await getActivityStream(env, { since, limit });

  // Format for display
  const formatted = activities.map(activity => ({
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
    tripId: activity.metadata?.tripId,
    ageClass: activity.ageClass,
    ageSeconds: activity.ageSeconds,
    ageDisplay: formatAge(activity.ageSeconds)
  }));

  return new Response(JSON.stringify({
    activities: formatted,
    count: formatted.length,
    since,
    serverTime: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
};

/**
 * Format timestamp for arrivals board display (HH:MM)
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Format tool name into readable action
 */
function formatToolAction(tool: string): string {
  const actions: Record<string, string> = {
    get_context: 'SESSION START',
    list_trips: 'LIST TRIPS',
    read_trip: 'READ TRIP',
    read_trip_section: 'READ SECTION',
    save_trip: 'SAVE TRIP',
    patch_trip: 'UPDATE TRIP',
    delete_trip: 'DELETE TRIP',
    list_templates: 'LIST TEMPLATES',
    preview_publish: 'PREVIEW',
    publish_trip: 'PUBLISH',
    validate_trip: 'VALIDATE',
    import_quote: 'IMPORT QUOTE',
    analyze_profitability: 'ANALYZE',
    get_prompt: 'GET PROMPT',
    get_comments: 'GET COMMENTS',
    get_all_comments: 'ALL COMMENTS',
    dismiss_comments: 'DISMISS',
    submit_support: 'SUPPORT REQ',
    reply_to_admin: 'USER REPLY',
    dismiss_admin_message: 'DISMISS MSG',
    add_trip_image: 'ADD IMAGE',
    prepare_image_upload: 'PREP UPLOAD',
    youtube_search: 'YOUTUBE'
  };

  return actions[tool] || tool.toUpperCase().replace(/_/g, ' ');
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
