/**
 * Admin MCP Tool Handlers
 * Implementation of admin tools for the /admin/mcp endpoint
 */

import type { Env, UserProfile } from '../../types';
import {
  getRealtimeCalls,
  getToolUsageSummary,
  computeInsights,
  getResponseSizeBenchmarks
} from '../../lib/metrics';
import {
  listAllKeys,
  getKeyPrefix,
  getTripIndex,
  removeFromTripIndex
} from '../../lib/kv';

type AdminToolHandler = (
  args: Record<string, any>,
  env: Env
) => Promise<{ content: Array<{ type: string; text: string }> }>;

// ============ Helper Functions ============

function text(content: string) {
  return { content: [{ type: 'text', text: content }] };
}

function json(data: any) {
  return text(JSON.stringify(data, null, 2));
}

// ============ Context Handler - Call First ============

export const handleAdminGetContext: AdminToolHandler = async (args, env) => {
  // Load admin system prompt from KV
  let systemPrompt = await env.TRIPS.get('_prompts/admin-system-prompt', 'text');
  if (!systemPrompt) {
    systemPrompt = `# Voygent Admin MCP

You are an administrative assistant for Voygent with full access to the KV data store.

## Quick Start
- Use admin_get_overview for platform health
- Use admin_search_trips / admin_search_users to find data
- Use admin_read_trip / admin_read_kv to inspect data

## Key Patterns
- Trip data: {keyPrefix}{tripId} (e.g., kim_d63b7658/alaska-cruise)
- Profiles: _profile/{userId} (may not exist)
- Summaries: _trip_summaries (global trip index)

See tool descriptions for usage details.`;
  }

  // Get quick overview stats
  const [allKeys, recentActivity, summaries] = await Promise.all([
    listAllKeys(env, { prefix: '' }),
    getRealtimeCalls(env, { limit: 10 }),
    env.TRIPS.get('_trip_summaries', 'json') as Promise<Record<string, any> | null>
  ]);

  // Count key categories
  const stats = {
    totalKeys: allKeys.length,
    trips: 0,
    profiles: 0,
    system: 0
  };
  for (const key of allKeys) {
    if (key.name.startsWith('_profile/')) stats.profiles++;
    else if (key.name.startsWith('_')) stats.system++;
    else if (key.name.includes('/')) stats.trips++;
  }

  // Count trips by phase
  const phases: Record<string, number> = {};
  let pendingComments = 0;
  if (summaries) {
    for (const summary of Object.values(summaries)) {
      const phase = summary.meta?.phase || 'unknown';
      phases[phase] = (phases[phase] || 0) + 1;
      if (summary.unreadComments > 0) pendingComments += summary.unreadComments;
    }
  }

  const context = {
    _instruction: "Use this system prompt to guide your admin operations. Call admin_get_overview for more details.",
    systemPrompt,
    platformSnapshot: {
      totalKeys: stats.totalKeys,
      trips: stats.trips,
      profiles: stats.profiles,
      systemKeys: stats.system,
      tripsByPhase: phases,
      pendingComments
    },
    recentActivity: recentActivity.slice(0, 5).map(a => ({
      time: a.timestamp,
      user: a.userName || a.userId,
      tool: a.tool,
      success: a.success
    })),
    timestamp: new Date().toISOString()
  };

  return json(context);
};

async function getAllUsers(env: Env): Promise<UserProfile[]> {
  const list = await env.TRIPS.list({ prefix: '_profile/' });

  // Fetch all profiles in parallel to avoid N+1 query pattern
  const profiles = await Promise.all(
    list.keys.map(key => env.TRIPS.get(key.name, 'json') as Promise<UserProfile | null>)
  );

  return profiles.filter((p): p is UserProfile => p !== null);
}

// ============ Read Tool Handlers ============

export const handleAdminGetOverview: AdminToolHandler = async (args, env) => {
  const [users, insights, summary] = await Promise.all([
    getAllUsers(env),
    computeInsights(env),
    getToolUsageSummary(env, 'day')
  ]);

  // Get trip counts
  const allTrips = await env.TRIPS.list({ prefix: '' });
  const tripCount = allTrips.keys.filter(k =>
    !k.name.startsWith('_') && k.name.includes('/')
  ).length;

  // Calculate subscription stats
  const subStats = {
    active: 0,
    trialing: 0,
    pastDue: 0,
    mrr: 0
  };

  for (const user of users) {
    if (user.subscription) {
      if (user.subscription.status === 'active') subStats.active++;
      if (user.subscription.status === 'trialing') subStats.trialing++;
      if (user.subscription.status === 'past_due') subStats.pastDue++;
      // Estimate MRR (would need real pricing data)
      if (user.subscription.status === 'active' || user.subscription.status === 'trialing') {
        const tierPrices: Record<string, number> = {
          starter: 29,
          professional: 79,
          agency: 199
        };
        subStats.mrr += tierPrices[user.subscription.tier] || 0;
      }
    }
  }

  const overview = {
    users: {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      byStatus: {
        active: users.filter(u => u.status === 'active').length,
        inactive: users.filter(u => u.status === 'inactive').length,
        pending: users.filter(u => u.status === 'pending').length,
        suspended: users.filter(u => u.status === 'suspended').length
      }
    },
    trips: {
      total: tripCount
    },
    activity: {
      callsToday: summary.totalCalls,
      uniqueUsersToday: summary.uniqueUsers,
      errorRate: Math.round(summary.errorRate * 10) / 10 + '%',
      trend: insights.trends.changePercent > 0 ? 'up' : insights.trends.changePercent < 0 ? 'down' : 'flat',
      trendPercent: Math.round(insights.trends.changePercent) + '%'
    },
    subscriptions: subStats,
    healthScore: insights.healthScore,
    alerts: insights.atRiskUsers.length > 0
      ? `${insights.atRiskUsers.length} at-risk user(s) detected`
      : 'No alerts'
  };

  return json(overview);
};

export const handleAdminGetActivity: AdminToolHandler = async (args, env) => {
  const limit = Math.min(args.limit || 50, 200);

  // Use getRealtimeCalls which supports all filter options
  let activities = await getRealtimeCalls(env, {
    limit,
    since: args.since,
    userId: args.userId,
    tool: args.tool
  });

  return json({
    count: activities.length,
    activities: activities.map(a => ({
      timestamp: a.timestamp,
      user: a.userName || a.userId,
      tool: a.tool,
      success: a.success,
      durationMs: a.durationMs,
      tripId: a.metadata?.tripId,
      errorType: a.errorType
    }))
  });
};

export const handleAdminGetToolUsage: AdminToolHandler = async (args, env) => {
  const period = args.period || 'day';
  const summary = await getToolUsageSummary(env, period);

  return json({
    period: summary.period,
    totalCalls: summary.totalCalls,
    uniqueUsers: summary.uniqueUsers,
    errorRate: Math.round(summary.errorRate * 10) / 10 + '%',
    peakHour: summary.peakHour,
    tools: Object.entries(summary.tools)
      .map(([name, stats]) => ({
        name,
        calls: stats.count,
        successRate: Math.round(stats.successRate) + '%',
        avgResponseMs: stats.avgDurationMs,
        p95ResponseMs: stats.p95DurationMs,
        // Response size stats (may be 0 for tools without data yet)
        avgBytes: stats.avgBytes,
        p95Bytes: stats.p95Bytes,
        maxBytes: stats.maxBytes
      }))
      .sort((a, b) => b.calls - a.calls)
  });
};

export const handleAdminGetUserAnalytics: AdminToolHandler = async (args, env) => {
  const { userId } = args;

  // Find user profile
  const profileKey = `_profile/${userId}`;
  const profile = await env.TRIPS.get(profileKey, 'json') as UserProfile | null;

  if (!profile) {
    return text(`User not found: ${userId}`);
  }

  // Get user's activity
  const activities = await getRealtimeCalls(env, { userId, limit: 100 });

  // Get user's trips
  const keyPrefix = userId.toLowerCase().replace(/\./g, '_') + '/';
  const tripList = await env.TRIPS.list({ prefix: keyPrefix });
  const trips = tripList.keys.filter(k => !k.name.includes('_comments'));

  // Calculate stats
  const toolUsage: Record<string, number> = {};
  for (const activity of activities) {
    toolUsage[activity.tool] = (toolUsage[activity.tool] || 0) + 1;
  }

  const lastActive = activities[0]?.timestamp || profile.lastActive;
  const daysSinceActive = Math.floor(
    (Date.now() - new Date(lastActive).getTime()) / (24 * 60 * 60 * 1000)
  );

  return json({
    user: {
      id: profile.userId,
      name: profile.name,
      email: profile.email,
      agency: profile.agency.name,
      status: profile.status,
      created: profile.created,
      lastActive
    },
    subscription: profile.subscription || null,
    activity: {
      daysSinceActive,
      recentCalls: activities.length,
      topTools: Object.entries(toolUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tool, count]) => ({ tool, count }))
    },
    trips: {
      count: trips.length,
      ids: trips.map(t => t.name.replace(keyPrefix, ''))
    }
  });
};

export const handleAdminGetUserSegments: AdminToolHandler = async (args, env) => {
  const insights = await computeInsights(env);

  return json({
    segments: {
      power: {
        description: '50+ calls this week',
        count: insights.userSegments.power.length,
        users: insights.userSegments.power.slice(0, 10)
      },
      regular: {
        description: '20-49 calls this week',
        count: insights.userSegments.regular.length,
        users: insights.userSegments.regular.slice(0, 10)
      },
      light: {
        description: '5-19 calls this week',
        count: insights.userSegments.light.length,
        users: insights.userSegments.light.slice(0, 10)
      },
      dormant: {
        description: '<5 calls this week',
        count: insights.userSegments.dormant.length,
        users: insights.userSegments.dormant.slice(0, 10)
      }
    }
  });
};

export const handleAdminGetAtRiskUsers: AdminToolHandler = async (args, env) => {
  const insights = await computeInsights(env);

  return json({
    count: insights.atRiskUsers.length,
    description: 'Users inactive for 3+ days who were previously active',
    users: insights.atRiskUsers.map(u => ({
      userId: u.userId,
      name: u.userName,
      lastSeen: u.lastSeen,
      daysSinceActive: u.daysSinceActive
    }))
  });
};

export const handleAdminGetPerformance: AdminToolHandler = async (args, env) => {
  const period = args.period || 'day';
  const summary = await getToolUsageSummary(env, period);

  // Find slow operations
  const slowTools = Object.entries(summary.tools)
    .filter(([_, stats]) => stats.p95DurationMs > 1000)
    .map(([name, stats]) => ({ name, p95Ms: stats.p95DurationMs }))
    .sort((a, b) => b.p95Ms - a.p95Ms);

  // Find error-prone tools
  const errorTools = Object.entries(summary.tools)
    .filter(([_, stats]) => stats.count > 10 && (100 - stats.successRate) > 5)
    .map(([name, stats]) => ({
      name,
      errorRate: Math.round(100 - stats.successRate) + '%',
      calls: stats.count
    }))
    .sort((a, b) => parseFloat(b.errorRate) - parseFloat(a.errorRate));

  // Find heavy tools (large response sizes > 5KB avg)
  const heavyTools = Object.entries(summary.tools)
    .filter(([_, stats]) => stats.avgBytes > 5000)
    .map(([name, stats]) => ({
      name,
      avgBytes: stats.avgBytes,
      p95Bytes: stats.p95Bytes,
      maxBytes: stats.maxBytes,
      // Rough token estimate for context
      estimatedTokens: Math.round(stats.avgBytes / 4)
    }))
    .sort((a, b) => b.avgBytes - a.avgBytes);

  return json({
    period: summary.period,
    overview: {
      totalCalls: summary.totalCalls,
      errorRate: Math.round(summary.errorRate * 10) / 10 + '%',
      peakHour: summary.peakHour
    },
    slowOperations: slowTools,
    errorProneTools: errorTools,
    heavyTools,  // Tools with large response sizes
    toolPerformance: Object.entries(summary.tools)
      .map(([name, stats]) => ({
        name,
        calls: stats.count,
        avgMs: stats.avgDurationMs,
        p95Ms: stats.p95DurationMs,
        avgBytes: stats.avgBytes,
        successRate: Math.round(stats.successRate) + '%'
      }))
      .sort((a, b) => b.calls - a.calls)
  });
};

export const handleAdminGetResponseSizes: AdminToolHandler = async (args, env) => {
  const period = args.period || 'week';
  const benchmarks = await getResponseSizeBenchmarks(env, period);

  // Format for display
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return json({
    period: benchmarks.period,
    summary: {
      totalAvgBytesPerCall: benchmarks.totalAvgBytesPerCall,
      totalAvgBytesFormatted: formatBytes(benchmarks.totalAvgBytesPerCall),
      largestTools: benchmarks.largestTools,
      toolCount: benchmarks.benchmarks.length
    },
    _note: 'Token estimates are rough (bytes/4). Actual tokenization varies by model.',
    benchmarks: benchmarks.benchmarks.map(b => ({
      tool: b.tool,
      calls: b.callCount,
      avgBytes: b.avgBytes,
      avgFormatted: formatBytes(b.avgBytes),
      p95Bytes: b.p95Bytes,
      maxBytes: b.maxBytes,
      estimatedAvgTokens: b.estimatedAvgTokens,
      estimatedP95Tokens: b.estimatedP95Tokens
    }))
  });
};

export const handleAdminGetRevenue: AdminToolHandler = async (args, env) => {
  const users = await getAllUsers(env);

  const tierPrices: Record<string, number> = {
    starter: 29,
    professional: 79,
    agency: 199
  };

  const byTier: Record<string, number> = {
    trial: 0,
    starter: 0,
    professional: 0,
    agency: 0
  };

  let mrr = 0;
  const subscribers: Array<{
    name: string;
    tier: string;
    status: string;
    periodEnd?: string;
  }> = [];

  for (const user of users) {
    if (user.subscription) {
      const tier = user.subscription.tier;
      byTier[tier] = (byTier[tier] || 0) + 1;

      if (user.subscription.status === 'active' || user.subscription.status === 'trialing') {
        mrr += tierPrices[tier] || 0;
        subscribers.push({
          name: user.name,
          tier: user.subscription.tier,
          status: user.subscription.status,
          periodEnd: user.subscription.currentPeriodEnd
        });
      }
    }
  }

  return json({
    mrr: `$${mrr}`,
    byTier,
    totalSubscribers: Object.values(byTier).reduce((a, b) => a + b, 0),
    activeSubscribers: subscribers.filter(s => s.status === 'active').length,
    trialingSubscribers: subscribers.filter(s => s.status === 'trialing').length,
    recentSubscribers: subscribers
      .sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || ''))
      .slice(0, 10)
  });
};

export const handleAdminSearchUsers: AdminToolHandler = async (args, env) => {
  const { query, tier, status } = args;
  let users = await getAllUsers(env);

  // Apply filters
  if (query) {
    const q = query.toLowerCase();
    users = users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.agency.name.toLowerCase().includes(q) ||
      u.userId.toLowerCase().includes(q)
    );
  }

  if (tier) {
    users = users.filter(u => u.subscription?.tier === tier);
  }

  if (status) {
    users = users.filter(u => u.status === status);
  }

  return json({
    count: users.length,
    users: users.map(u => ({
      id: u.userId,
      name: u.name,
      email: u.email,
      agency: u.agency.name,
      status: u.status,
      tier: u.subscription?.tier || 'none',
      lastActive: u.lastActive
    }))
  });
};

export const handleAdminSearchTrips: AdminToolHandler = async (args, env) => {
  const { query, phase, hasComments } = args;

  // Get all trip summaries
  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;

  if (!summaries) {
    return json({ count: 0, trips: [] });
  }

  let trips = Object.values(summaries) as any[];

  // Apply filters
  if (query) {
    const q = query.toLowerCase();
    trips = trips.filter((t: any) =>
      t.tripId?.toLowerCase().includes(q) ||
      t.meta?.destination?.toLowerCase().includes(q) ||
      t.meta?.clientName?.toLowerCase().includes(q)
    );
  }

  if (phase) {
    trips = trips.filter((t: any) => t.meta?.phase === phase);
  }

  if (hasComments) {
    trips = trips.filter((t: any) => (t.unreadComments || 0) > 0);
  }

  return json({
    count: trips.length,
    trips: trips.slice(0, 50).map((t: any) => ({
      id: t.tripId,
      userId: t.userId,
      userName: t.userName,
      destination: t.meta?.destination,
      clientName: t.meta?.clientName,
      phase: t.meta?.phase,
      dates: t.meta?.dates,
      unreadComments: t.unreadComments || 0
    }))
  });
};

// ============ Action Tool Handlers ============

export const handleAdminSendMessage: AdminToolHandler = async (args, env) => {
  const { userId, subject, body } = args;

  // Verify user exists
  const profile = await env.TRIPS.get(`_profile/${userId}`, 'json');
  if (!profile) {
    return text(`Error: User not found: ${userId}`);
  }

  // Create message thread
  const threadId = crypto.randomUUID().substring(0, 8);
  const thread = {
    id: threadId,
    userId,
    subject,
    status: 'open',
    createdAt: new Date().toISOString(),
    lastMessageAt: new Date().toISOString(),
    messages: [{
      id: crypto.randomUUID().substring(0, 8),
      sender: 'admin',
      senderName: 'Admin',
      body,
      timestamp: new Date().toISOString(),
      read: false
    }]
  };

  // Get user's message threads
  const threadsKey = `${userId.toLowerCase().replace(/\./g, '_')}/_dm_threads`;
  const existing = await env.TRIPS.get(threadsKey, 'json') as any[] || [];
  existing.unshift(thread);
  await env.TRIPS.put(threadsKey, JSON.stringify(existing));

  return json({
    success: true,
    threadId,
    message: `Message sent to ${userId}`
  });
};

export const handleAdminSendBroadcast: AdminToolHandler = async (args, env) => {
  const { title, body, priority = 'normal', targetTiers } = args;

  const broadcastId = crypto.randomUUID().substring(0, 8);
  const broadcast = {
    id: broadcastId,
    title,
    body,
    priority,
    targetTiers: targetTiers || [],
    createdAt: new Date().toISOString(),
    dismissedBy: []
  };

  // Get existing broadcasts
  const existing = await env.TRIPS.get('_broadcasts', 'json') as any[] || [];
  existing.unshift(broadcast);

  // Keep last 20 broadcasts
  await env.TRIPS.put('_broadcasts', JSON.stringify(existing.slice(0, 20)));

  return json({
    success: true,
    broadcastId,
    message: `Broadcast "${title}" sent${targetTiers?.length ? ` to ${targetTiers.join(', ')} tiers` : ' to all users'}`
  });
};

export const handleAdminCreatePromo: AdminToolHandler = async (args, env) => {
  const { name, percentOff, amountOff, duration = 'once', durationInMonths, maxRedemptions } = args;

  if (!percentOff && !amountOff) {
    return text('Error: Must specify either percentOff or amountOff');
  }

  // Would call Stripe API here in production
  // For now, simulate success
  const promo = {
    code: name.toUpperCase(),
    percentOff,
    amountOff,
    duration,
    durationInMonths,
    maxRedemptions,
    createdAt: new Date().toISOString()
  };

  return json({
    success: true,
    promo,
    message: `Promo code ${promo.code} created: ${percentOff ? percentOff + '% off' : '$' + amountOff + ' off'}`
  });
};

export const handleAdminUpdateUser: AdminToolHandler = async (args, env) => {
  const { userId, status, name, email, notes } = args;

  const profileKey = `_profile/${userId}`;
  const profile = await env.TRIPS.get(profileKey, 'json') as UserProfile | null;

  if (!profile) {
    return text(`Error: User not found: ${userId}`);
  }

  // Apply updates
  const updates: string[] = [];
  if (status && status !== profile.status) {
    profile.status = status;
    updates.push(`status → ${status}`);
  }
  if (name && name !== profile.name) {
    profile.name = name;
    updates.push(`name → ${name}`);
  }
  if (email && email !== profile.email) {
    profile.email = email;
    updates.push(`email → ${email}`);
  }

  await env.TRIPS.put(profileKey, JSON.stringify(profile));

  return json({
    success: true,
    userId,
    updates,
    message: updates.length > 0
      ? `Updated ${userId}: ${updates.join(', ')}`
      : 'No changes made'
  });
};

// ============ Direct KV Access Handlers ============

export const handleAdminReadKv: AdminToolHandler = async (args, env) => {
  const { key } = args;

  if (!key) {
    return text('Error: key is required');
  }

  const value = await env.TRIPS.get(key, 'text');
  if (value === null) {
    return json({ found: false, key, value: null });
  }

  // Try to parse as JSON for better display
  let parsed: any;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = value; // Return raw if not JSON
  }

  return json({
    found: true,
    key,
    value: parsed,
    size: value.length
  });
};

export const handleAdminListKvKeys: AdminToolHandler = async (args, env) => {
  const { prefix = '', limit = 100 } = args;
  const maxLimit = Math.min(limit, 1000);

  // Use efficient paginated listing
  const allKeys = await listAllKeys(env, { prefix });
  const keys = allKeys.slice(0, maxLimit);

  // Categorize keys for easier browsing
  const categories: Record<string, string[]> = {
    profiles: [],
    trips: [],
    system: [],
    metrics: [],
    other: []
  };

  for (const key of keys) {
    const name = key.name;
    if (name.startsWith('_profile/')) {
      categories.profiles.push(name);
    } else if (name.startsWith('_metrics/')) {
      categories.metrics.push(name);
    } else if (name.startsWith('_')) {
      categories.system.push(name);
    } else if (name.includes('/')) {
      categories.trips.push(name);
    } else {
      categories.other.push(name);
    }
  }

  return json({
    totalFound: allKeys.length,
    returned: keys.length,
    prefix: prefix || '(all)',
    categories: {
      profiles: categories.profiles.length,
      trips: categories.trips.length,
      system: categories.system.length,
      metrics: categories.metrics.length,
      other: categories.other.length
    },
    keys: keys.map(k => k.name)
  });
};

export const handleAdminSearchKv: AdminToolHandler = async (args, env) => {
  const { query, keyPrefix = '', limit = 20 } = args;
  const maxLimit = Math.min(limit, 100);

  if (!query) {
    return text('Error: query is required');
  }

  const queryLower = query.toLowerCase();

  // Get keys to search (use trip summaries for efficiency when searching trips)
  let results: Array<{ key: string; matchType: string; preview: string }> = [];

  // First, check trip summaries for efficient trip searching
  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (summaries) {
    for (const [tripId, summary] of Object.entries(summaries)) {
      if (results.length >= maxLimit) break;
      const summaryStr = JSON.stringify(summary).toLowerCase();
      if (summaryStr.includes(queryLower)) {
        results.push({
          key: `trip:${summary.userId}/${tripId}`,
          matchType: 'trip_summary',
          preview: `${summary.meta?.clientName || 'Unknown'} - ${summary.meta?.destination || 'Unknown destination'}`
        });
      }
    }
  }

  // Search profiles
  const profileKeys = await listAllKeys(env, { prefix: '_profile/' });
  for (const key of profileKeys) {
    if (results.length >= maxLimit) break;
    const value = await env.TRIPS.get(key.name, 'text');
    if (value && value.toLowerCase().includes(queryLower)) {
      const profile = JSON.parse(value);
      results.push({
        key: key.name,
        matchType: 'profile',
        preview: `${profile.name} (${profile.email})`
      });
    }
  }

  // If keyPrefix specified, search those keys directly
  if (keyPrefix) {
    const keys = await listAllKeys(env, { prefix: keyPrefix });
    for (const key of keys.slice(0, 50)) { // Limit direct searches
      if (results.length >= maxLimit) break;
      const value = await env.TRIPS.get(key.name, 'text');
      if (value && value.toLowerCase().includes(queryLower)) {
        results.push({
          key: key.name,
          matchType: 'direct',
          preview: value.substring(0, 100) + (value.length > 100 ? '...' : '')
        });
      }
    }
  }

  return json({
    query,
    resultCount: results.length,
    results
  });
};

// ============ Trip Admin Handlers ============

export const handleAdminReadTrip: AdminToolHandler = async (args, env) => {
  const { tripId, userId } = args;

  if (!tripId) {
    return text('Error: tripId is required');
  }

  // If userId provided, construct key directly
  if (userId) {
    const keyPrefix = getKeyPrefix(userId);
    const tripKey = `${keyPrefix}${tripId}`;
    const trip = await env.TRIPS.get(tripKey, 'json');
    if (!trip) {
      return json({ found: false, tripId, userId, message: 'Trip not found' });
    }
    return json({ found: true, tripId, userId, keyPrefix, data: trip });
  }

  // Otherwise, look up in trip summaries first (efficient)
  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (summaries && summaries[tripId]) {
    const summary = summaries[tripId];
    // Use keyPrefix directly if available (already formatted), otherwise derive from userId
    const keyPrefix = summary.keyPrefix || (summary.userId + '/');
    const tripKey = `${keyPrefix}${tripId}`;
    const trip = await env.TRIPS.get(tripKey, 'json');
    if (trip) {
      return json({
        found: true,
        tripId,
        userId: summary.userId,
        keyPrefix,
        summary,
        data: trip
      });
    }
  }

  // Last resort: scan all keys (expensive)
  const allKeys = await listAllKeys(env, { prefix: '' });
  for (const key of allKeys) {
    if (key.name.endsWith(`/${tripId}`)) {
      const trip = await env.TRIPS.get(key.name, 'json');
      return json({
        found: true,
        tripId,
        key: key.name,
        data: trip,
        note: 'Found via key scan (not in summaries)'
      });
    }
  }

  return json({ found: false, tripId, message: 'Trip not found in any user namespace' });
};

export const handleAdminDeleteTrip: AdminToolHandler = async (args, env) => {
  const { tripId, userId, confirm } = args;

  if (!tripId || !userId) {
    return text('Error: tripId and userId are required');
  }

  if (!confirm) {
    return text('Error: confirm must be true to delete. This action is irreversible.');
  }

  const keyPrefix = getKeyPrefix(userId);
  const tripKey = `${keyPrefix}${tripId}`;

  // Check if trip exists
  const existing = await env.TRIPS.get(tripKey);
  if (!existing) {
    return json({ success: false, message: `Trip not found: ${tripKey}` });
  }

  // Delete the trip
  await env.TRIPS.delete(tripKey);

  // Delete associated comments
  const commentsKey = `${keyPrefix}${tripId}/_comments`;
  await env.TRIPS.delete(commentsKey);

  // Delete reference data
  const refKey = `_refs/${tripId}`;
  await env.TRIPS.delete(refKey);

  // Remove from trip index
  await removeFromTripIndex(env, keyPrefix, tripId);

  // Remove from trip summaries
  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (summaries && summaries[tripId]) {
    delete summaries[tripId];
    await env.TRIPS.put('_trip_summaries', JSON.stringify(summaries));
  }

  return json({
    success: true,
    deleted: {
      trip: tripKey,
      comments: commentsKey,
      reference: refKey
    },
    message: `Trip ${tripId} and associated data deleted`
  });
};

export const handleAdminTransferTrip: AdminToolHandler = async (args, env) => {
  const { tripId, fromUserId, toUserId } = args;

  if (!tripId || !fromUserId || !toUserId) {
    return text('Error: tripId, fromUserId, and toUserId are required');
  }

  const fromKeyPrefix = getKeyPrefix(fromUserId);
  const toKeyPrefix = getKeyPrefix(toUserId);

  // Get the trip data
  const fromTripKey = `${fromKeyPrefix}${tripId}`;
  const tripData = await env.TRIPS.get(fromTripKey, 'json');
  if (!tripData) {
    return json({ success: false, message: `Trip not found: ${fromTripKey}` });
  }

  // Verify target user exists
  const toProfile = await env.TRIPS.get(`_profile/${toUserId}`, 'json');
  if (!toProfile) {
    return json({ success: false, message: `Target user not found: ${toUserId}` });
  }

  // Copy to new location
  const toTripKey = `${toKeyPrefix}${tripId}`;
  await env.TRIPS.put(toTripKey, JSON.stringify(tripData));

  // Copy comments if they exist
  const fromCommentsKey = `${fromKeyPrefix}${tripId}/_comments`;
  const comments = await env.TRIPS.get(fromCommentsKey, 'json');
  if (comments) {
    const toCommentsKey = `${toKeyPrefix}${tripId}/_comments`;
    await env.TRIPS.put(toCommentsKey, JSON.stringify(comments));
    await env.TRIPS.delete(fromCommentsKey);
  }

  // Delete from old location
  await env.TRIPS.delete(fromTripKey);

  // Update trip indexes
  await removeFromTripIndex(env, fromKeyPrefix, tripId);
  // Force rebuild of target index
  const toIndex = await getTripIndex(env, toKeyPrefix);
  if (!toIndex.includes(tripId)) {
    await env.TRIPS.put(`${toKeyPrefix}_trip-index`, JSON.stringify([...toIndex, tripId]));
  }

  // Update trip summaries
  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (summaries && summaries[tripId]) {
    summaries[tripId].userId = toUserId;
    summaries[tripId].keyPrefix = toKeyPrefix;
    await env.TRIPS.put('_trip_summaries', JSON.stringify(summaries));
  }

  return json({
    success: true,
    tripId,
    from: { userId: fromUserId, key: fromTripKey },
    to: { userId: toUserId, key: toTripKey },
    message: `Trip ${tripId} transferred from ${fromUserId} to ${toUserId}`
  });
};

// ============ User Data Deep Access Handlers ============

export const handleAdminGetUserTrips: AdminToolHandler = async (args, env) => {
  const { userId, includeData = false } = args;

  if (!userId) {
    return text('Error: userId is required');
  }

  // Get user profile
  const profile = await env.TRIPS.get(`_profile/${userId}`, 'json') as UserProfile | null;
  if (!profile) {
    return json({ found: false, userId, message: 'User not found' });
  }

  const keyPrefix = getKeyPrefix(userId);

  // Use efficient trip index
  const tripIds = await getTripIndex(env, keyPrefix);

  if (!includeData) {
    // Return summaries only (efficient)
    const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
    const tripSummaries = tripIds.map(id => summaries?.[id] || { tripId: id, status: 'unknown' });
    return json({
      userId,
      userName: profile.name,
      tripCount: tripIds.length,
      trips: tripSummaries
    });
  }

  // Load full trip data (more expensive)
  const trips = [];
  for (const tripId of tripIds) {
    const tripKey = `${keyPrefix}${tripId}`;
    const trip = await env.TRIPS.get(tripKey, 'json');
    if (trip) {
      trips.push({ tripId, data: trip });
    }
  }

  return json({
    userId,
    userName: profile.name,
    tripCount: trips.length,
    trips
  });
};

export const handleAdminExportUserData: AdminToolHandler = async (args, env) => {
  const { userId } = args;

  if (!userId) {
    return text('Error: userId is required');
  }

  // Get profile
  const profile = await env.TRIPS.get(`_profile/${userId}`, 'json') as UserProfile | null;
  if (!profile) {
    return json({ success: false, message: `User not found: ${userId}` });
  }

  const keyPrefix = getKeyPrefix(userId);
  const export_data: any = {
    exportedAt: new Date().toISOString(),
    userId,
    profile
  };

  // Get all trips
  const tripIds = await getTripIndex(env, keyPrefix);
  export_data.trips = [];
  for (const tripId of tripIds) {
    const tripKey = `${keyPrefix}${tripId}`;
    const trip = await env.TRIPS.get(tripKey, 'json');
    if (trip) {
      // Get comments too
      const comments = await env.TRIPS.get(`${keyPrefix}${tripId}/_comments`, 'json');
      export_data.trips.push({
        tripId,
        data: trip,
        comments: comments || []
      });
    }
  }

  // Get direct messages
  const dmThreads = await env.TRIPS.get(`${keyPrefix}/_dm_threads`, 'json');
  export_data.directMessages = dmThreads || [];

  // Get any other user-specific data
  const allUserKeys = await listAllKeys(env, { prefix: keyPrefix });
  export_data.additionalKeys = allUserKeys.map(k => k.name).filter(k =>
    !tripIds.some(t => k.includes(t)) && !k.includes('_trip-index') && !k.includes('_dm_threads')
  );

  return json({
    success: true,
    export: export_data
  });
};

// ============ System Maintenance Handlers ============

export const handleAdminGetStorageStats: AdminToolHandler = async (args, env) => {
  const allKeys = await listAllKeys(env, { prefix: '' });

  const stats = {
    totalKeys: allKeys.length,
    byCategory: {
      profiles: 0,
      trips: 0,
      tripIndexes: 0,
      comments: 0,
      references: 0,
      metrics: 0,
      broadcasts: 0,
      messages: 0,
      system: 0,
      other: 0
    },
    byUser: {} as Record<string, number>,
    largeKeys: [] as Array<{ key: string; size: number }>
  };

  for (const key of allKeys) {
    const name = key.name;

    // Categorize
    if (name.startsWith('_profile/')) {
      stats.byCategory.profiles++;
    } else if (name.startsWith('_metrics/')) {
      stats.byCategory.metrics++;
    } else if (name.startsWith('_refs/')) {
      stats.byCategory.references++;
    } else if (name.startsWith('_broadcasts')) {
      stats.byCategory.broadcasts++;
    } else if (name.startsWith('_admin_messages')) {
      stats.byCategory.messages++;
    } else if (name.startsWith('_')) {
      stats.byCategory.system++;
    } else if (name.includes('/_comments')) {
      stats.byCategory.comments++;
    } else if (name.includes('_trip-index')) {
      stats.byCategory.tripIndexes++;
    } else if (name.includes('/')) {
      stats.byCategory.trips++;
      // Track per-user
      const userPrefix = name.split('/')[0];
      stats.byUser[userPrefix] = (stats.byUser[userPrefix] || 0) + 1;
    } else {
      stats.byCategory.other++;
    }
  }

  // Get top 5 users by trip count
  const topUsers = Object.entries(stats.byUser)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([prefix, count]) => ({ prefix, tripCount: count }));

  return json({
    totalKeys: stats.totalKeys,
    byCategory: stats.byCategory,
    topUsers,
    userCount: Object.keys(stats.byUser).length
  });
};

export const handleAdminGetOrphanedData: AdminToolHandler = async (args, env) => {
  const { dryRun = true } = args;

  const orphans: Array<{ key: string; reason: string }> = [];
  const allKeys = await listAllKeys(env, { prefix: '' });

  // Get all valid user IDs from profiles
  const profileKeys = allKeys.filter(k => k.name.startsWith('_profile/'));
  const validUserIds = new Set(profileKeys.map(k => k.name.replace('_profile/', '')));

  // Get trip summaries for validation
  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  const validTripIds = new Set(summaries ? Object.keys(summaries) : []);

  for (const key of allKeys) {
    const name = key.name;

    // Skip system keys
    if (name.startsWith('_')) continue;

    // Check user data keys
    if (name.includes('/')) {
      const parts = name.split('/');
      const userPrefix = parts[0];

      // Check if this looks like trip data without a valid parent
      // This is a heuristic - prefixes should map to users
      const tripId = parts.length > 1 ? parts[1] : null;

      // Check for orphaned comments
      if (name.includes('/_comments') && tripId) {
        const baseTripId = tripId.replace('/_comments', '');
        if (!validTripIds.has(baseTripId)) {
          orphans.push({ key: name, reason: 'Comments for non-existent trip' });
        }
      }
    }
  }

  // Check for dangling references
  const refKeys = allKeys.filter(k => k.name.startsWith('_refs/'));
  for (const refKey of refKeys) {
    const tripId = refKey.name.replace('_refs/', '');
    if (!validTripIds.has(tripId)) {
      orphans.push({ key: refKey.name, reason: 'Reference for non-existent trip' });
    }
  }

  if (!dryRun && orphans.length > 0) {
    for (const orphan of orphans) {
      await env.TRIPS.delete(orphan.key);
    }
  }

  return json({
    orphanCount: orphans.length,
    dryRun,
    action: dryRun ? 'No changes made (dry run)' : `Deleted ${orphans.length} orphaned keys`,
    orphans
  });
};

export const handleAdminCleanupExpired: AdminToolHandler = async (args, env) => {
  const { olderThanDays = 30, dryRun = true } = args;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffMs = cutoffDate.getTime();

  const expired: Array<{ key: string; reason: string; age: string }> = [];
  const allKeys = await listAllKeys(env, { prefix: '' });

  // Check metric keys for old data
  const metricKeys = allKeys.filter(k => k.name.startsWith('_metrics/tools/'));
  for (const key of metricKeys) {
    // Key format: _metrics/tools/YYYY-MM-DD
    const dateStr = key.name.replace('_metrics/tools/', '');
    const keyDate = new Date(dateStr);
    if (!isNaN(keyDate.getTime()) && keyDate.getTime() < cutoffMs) {
      expired.push({
        key: key.name,
        reason: 'Old metrics data',
        age: `${Math.floor((Date.now() - keyDate.getTime()) / (24 * 60 * 60 * 1000))} days`
      });
    }
  }

  // Check for preview trips that might be stale
  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (summaries) {
    for (const [tripId, summary] of Object.entries(summaries)) {
      if (summary.lastUpdated) {
        const updateDate = new Date(summary.lastUpdated);
        if (updateDate.getTime() < cutoffMs && summary.meta?.phase === 'testing') {
          expired.push({
            key: `trip:${summary.userId}/${tripId}`,
            reason: 'Stale testing trip',
            age: `${Math.floor((Date.now() - updateDate.getTime()) / (24 * 60 * 60 * 1000))} days`
          });
        }
      }
    }
  }

  if (!dryRun && expired.length > 0) {
    for (const item of expired) {
      if (!item.key.startsWith('trip:')) {
        await env.TRIPS.delete(item.key);
      }
      // Note: trip deletion requires more care - not auto-deleting
    }
  }

  return json({
    expiredCount: expired.length,
    olderThanDays,
    cutoffDate: cutoffDate.toISOString(),
    dryRun,
    action: dryRun ? 'No changes made (dry run)' : `Cleaned up ${expired.length} expired items`,
    expired
  });
};

// ============ Reference Data Handlers ============

export const handleAdminListReferences: AdminToolHandler = async (args, env) => {
  const { tripId, limit = 50 } = args;

  // If specific trip requested
  if (tripId) {
    const refKey = `_refs/${tripId}`;
    const ref = await env.TRIPS.get(refKey, 'json');
    if (!ref) {
      return json({ found: false, tripId, message: 'No reference found for trip' });
    }
    return json({ found: true, tripId, reference: ref });
  }

  // List all references
  const refKeys = await listAllKeys(env, { prefix: '_refs/' });
  const references = [];

  for (const key of refKeys.slice(0, limit)) {
    const ref = await env.TRIPS.get(key.name, 'json') as any;
    if (ref) {
      references.push({
        tripId: key.name.replace('_refs/', ''),
        lastUpdated: ref.lastUpdated || ref.timestamp,
        type: ref.type || 'unknown',
        preview: ref.clientName || ref.destination || 'No preview'
      });
    }
  }

  return json({
    totalReferences: refKeys.length,
    returned: references.length,
    references
  });
};

export const handleAdminClearReference: AdminToolHandler = async (args, env) => {
  const { tripId, confirm } = args;

  if (!tripId) {
    return text('Error: tripId is required');
  }

  if (!confirm) {
    return text('Error: confirm must be true to clear reference. This removes source-of-truth data.');
  }

  const refKey = `_refs/${tripId}`;
  const existing = await env.TRIPS.get(refKey);

  if (!existing) {
    return json({ success: false, message: `No reference found for trip: ${tripId}` });
  }

  await env.TRIPS.delete(refKey);

  return json({
    success: true,
    tripId,
    message: `Reference cleared for trip ${tripId}. Trip can now be rebuilt from scratch.`
  });
};

// ============ Business Intelligence Handlers ============

export const handleAdminGetConversionFunnel: AdminToolHandler = async (args, env) => {
  const { period = 'month' } = args;

  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (!summaries) {
    return json({ error: 'No trip summaries available' });
  }

  // Calculate cutoff date
  const now = new Date();
  let cutoffMs = 0;
  switch (period) {
    case 'week': cutoffMs = now.getTime() - 7 * 24 * 60 * 60 * 1000; break;
    case 'month': cutoffMs = now.getTime() - 30 * 24 * 60 * 60 * 1000; break;
    case 'quarter': cutoffMs = now.getTime() - 90 * 24 * 60 * 60 * 1000; break;
    case 'all': cutoffMs = 0; break;
  }

  // Phase progression order
  const phaseOrder = ['testing', 'discovery', 'proposal', 'confirmed', 'deposit_paid', 'paid_in_full', 'active', 'past'];
  const phaseCounts: Record<string, number> = {};
  phaseOrder.forEach(p => phaseCounts[p] = 0);

  let totalTrips = 0;
  for (const summary of Object.values(summaries)) {
    const created = summary.created ? new Date(summary.created).getTime() : 0;
    if (cutoffMs > 0 && created < cutoffMs) continue;

    totalTrips++;
    const phase = summary.meta?.phase || 'unknown';
    if (phase in phaseCounts) {
      phaseCounts[phase]++;
    } else {
      phaseCounts[phase] = 1;
    }
  }

  // Calculate conversions
  const funnel = {
    period,
    totalTrips,
    stages: phaseOrder.map(phase => ({
      phase,
      count: phaseCounts[phase] || 0,
      percentage: totalTrips > 0 ? Math.round((phaseCounts[phase] || 0) / totalTrips * 100) : 0
    })),
    conversions: {
      discoveryToProposal: phaseCounts.discovery > 0
        ? Math.round((phaseCounts.proposal + phaseCounts.confirmed + phaseCounts.deposit_paid + phaseCounts.paid_in_full) / phaseCounts.discovery * 100)
        : 0,
      proposalToConfirmed: phaseCounts.proposal > 0
        ? Math.round((phaseCounts.confirmed + phaseCounts.deposit_paid + phaseCounts.paid_in_full) / phaseCounts.proposal * 100)
        : 0,
      confirmedToPaid: phaseCounts.confirmed > 0
        ? Math.round((phaseCounts.deposit_paid + phaseCounts.paid_in_full) / phaseCounts.confirmed * 100)
        : 0
    }
  };

  return json(funnel);
};

export const handleAdminGetDestinationStats: AdminToolHandler = async (args, env) => {
  const { limit = 20 } = args;

  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (!summaries) {
    return json({ error: 'No trip summaries available' });
  }

  const destinations: Record<string, { count: number; phases: Record<string, number>; users: Set<string> }> = {};

  for (const summary of Object.values(summaries)) {
    const dest = summary.meta?.destination;
    if (!dest) continue;

    // Normalize destination
    const normalized = dest.trim().toLowerCase().replace(/\s+/g, ' ');

    if (!destinations[normalized]) {
      destinations[normalized] = { count: 0, phases: {}, users: new Set() };
    }
    destinations[normalized].count++;
    destinations[normalized].users.add(summary.userId);

    const phase = summary.meta?.phase || 'unknown';
    destinations[normalized].phases[phase] = (destinations[normalized].phases[phase] || 0) + 1;
  }

  const sorted = Object.entries(destinations)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([dest, stats]) => ({
      destination: dest.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      tripCount: stats.count,
      uniqueUsers: stats.users.size,
      confirmedRate: stats.phases.confirmed || stats.phases.deposit_paid || stats.phases.paid_in_full
        ? Math.round(((stats.phases.confirmed || 0) + (stats.phases.deposit_paid || 0) + (stats.phases.paid_in_full || 0)) / stats.count * 100)
        : 0
    }));

  return json({
    totalDestinations: Object.keys(destinations).length,
    topDestinations: sorted
  });
};

export const handleAdminGetEngagementReport: AdminToolHandler = async (args, env) => {
  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  const users = await getAllUsers(env);

  const report = {
    totalTripsWithComments: 0,
    pendingResponses: 0,
    engagementByUser: [] as Array<{ userId: string; name: string; tripsWithComments: number; pendingComments: number }>
  };

  const userEngagement: Record<string, { tripsWithComments: number; pendingComments: number }> = {};

  if (summaries) {
    for (const [tripId, summary] of Object.entries(summaries)) {
      if (summary.unreadComments && summary.unreadComments > 0) {
        report.totalTripsWithComments++;
        report.pendingResponses += summary.unreadComments;

        const userId = summary.userId;
        if (!userEngagement[userId]) {
          userEngagement[userId] = { tripsWithComments: 0, pendingComments: 0 };
        }
        userEngagement[userId].tripsWithComments++;
        userEngagement[userId].pendingComments += summary.unreadComments;
      }
    }
  }

  report.engagementByUser = users
    .filter(u => userEngagement[u.userId])
    .map(u => ({
      userId: u.userId,
      name: u.name,
      tripsWithComments: userEngagement[u.userId].tripsWithComments,
      pendingComments: userEngagement[u.userId].pendingComments
    }))
    .sort((a, b) => b.pendingComments - a.pendingComments);

  return json(report);
};

// ============ Operational Handlers ============

export const handleAdminCloneTrip: AdminToolHandler = async (args, env) => {
  const { sourceTripId, sourceUserId, targetTripId, targetUserId, clearClientInfo = true } = args;

  const sourceKeyPrefix = getKeyPrefix(sourceUserId);
  const targetKeyPrefix = getKeyPrefix(targetUserId);

  // Get source trip
  const sourceKey = `${sourceKeyPrefix}${sourceTripId}`;
  const tripData = await env.TRIPS.get(sourceKey, 'json') as any;
  if (!tripData) {
    return json({ success: false, message: `Source trip not found: ${sourceKey}` });
  }

  // Check target doesn't exist
  const targetKey = `${targetKeyPrefix}${targetTripId}`;
  const existing = await env.TRIPS.get(targetKey);
  if (existing) {
    return json({ success: false, message: `Target trip already exists: ${targetKey}` });
  }

  // Clone and optionally clear client info
  const clonedTrip = JSON.parse(JSON.stringify(tripData));
  if (clearClientInfo && clonedTrip.meta) {
    clonedTrip.meta.clientName = '';
    clonedTrip.meta.clientEmail = '';
    clonedTrip.meta.clientPhone = '';
    clonedTrip.meta.phase = 'testing';
  }
  clonedTrip.clonedFrom = { tripId: sourceTripId, userId: sourceUserId, clonedAt: new Date().toISOString() };

  // Save clone
  await env.TRIPS.put(targetKey, JSON.stringify(clonedTrip));

  // Update target trip index
  const targetIndex = await getTripIndex(env, targetKeyPrefix);
  if (!targetIndex.includes(targetTripId)) {
    await env.TRIPS.put(`${targetKeyPrefix}_trip-index`, JSON.stringify([...targetIndex, targetTripId]));
  }

  return json({
    success: true,
    source: { tripId: sourceTripId, userId: sourceUserId },
    target: { tripId: targetTripId, userId: targetUserId, key: targetKey },
    clientInfoCleared: clearClientInfo
  });
};

export const handleAdminRebuildIndexes: AdminToolHandler = async (args, env) => {
  const { indexType = 'all', userId } = args;

  const results: any = { rebuilt: [], errors: [] };

  // Rebuild trip summaries
  if (indexType === 'trip_summaries' || indexType === 'all') {
    try {
      const allKeys = await listAllKeys(env, { prefix: '' });
      const newSummaries: Record<string, any> = {};

      for (const key of allKeys) {
        // Skip system keys and non-trip keys
        if (key.name.startsWith('_') || !key.name.includes('/')) continue;
        if (key.name.includes('/_') || key.name.includes('_trip-index')) continue;

        const tripData = await env.TRIPS.get(key.name, 'json') as any;
        if (tripData && tripData.meta) {
          const parts = key.name.split('/');
          const tripId = parts[parts.length - 1];
          newSummaries[tripId] = {
            tripId,
            userId: tripData.meta.userId || parts[0],
            keyPrefix: parts[0] + '/',
            meta: {
              clientName: tripData.meta.clientName,
              destination: tripData.meta.destination,
              dates: tripData.meta.dates,
              phase: tripData.meta.phase
            },
            lastUpdated: tripData.meta.lastUpdated || new Date().toISOString()
          };
        }
      }

      await env.TRIPS.put('_trip_summaries', JSON.stringify(newSummaries));
      results.rebuilt.push({ type: 'trip_summaries', tripCount: Object.keys(newSummaries).length });
    } catch (e: any) {
      results.errors.push({ type: 'trip_summaries', error: e.message });
    }
  }

  // Rebuild user trip indexes
  if (indexType === 'user_trip_indexes' || indexType === 'all') {
    try {
      const users = await getAllUsers(env);
      const targetUsers = userId ? users.filter(u => u.userId === userId) : users;

      for (const user of targetUsers) {
        const keyPrefix = getKeyPrefix(user.userId);
        const keys = await listAllKeys(env, { prefix: keyPrefix });
        const tripIds = keys
          .map(k => k.name.replace(keyPrefix, ''))
          .filter(k => !k.startsWith('_') && !k.includes('/_'));

        await env.TRIPS.put(`${keyPrefix}_trip-index`, JSON.stringify(tripIds));
        results.rebuilt.push({ type: 'user_trip_index', userId: user.userId, tripCount: tripIds.length });
      }
    } catch (e: any) {
      results.errors.push({ type: 'user_trip_indexes', error: e.message });
    }
  }

  return json({
    success: results.errors.length === 0,
    results
  });
};

export const handleAdminBulkUpdatePhase: AdminToolHandler = async (args, env) => {
  const { fromPhase, toPhase, userId, dryRun = true } = args;

  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (!summaries) {
    return json({ error: 'No trip summaries available' });
  }

  const matches: Array<{ tripId: string; userId: string; key: string }> = [];

  for (const [tripId, summary] of Object.entries(summaries)) {
    if (summary.meta?.phase !== fromPhase) continue;
    if (userId && summary.userId !== userId) continue;

    const keyPrefix = getKeyPrefix(summary.userId);
    matches.push({ tripId, userId: summary.userId, key: `${keyPrefix}${tripId}` });
  }

  if (!dryRun) {
    for (const match of matches) {
      const trip = await env.TRIPS.get(match.key, 'json') as any;
      if (trip && trip.meta) {
        trip.meta.phase = toPhase;
        await env.TRIPS.put(match.key, JSON.stringify(trip));

        // Update summaries
        if (summaries[match.tripId]) {
          summaries[match.tripId].meta.phase = toPhase;
        }
      }
    }
    await env.TRIPS.put('_trip_summaries', JSON.stringify(summaries));
  }

  return json({
    fromPhase,
    toPhase,
    matchCount: matches.length,
    dryRun,
    action: dryRun ? 'No changes made (dry run)' : `Updated ${matches.length} trips`,
    matches: matches.slice(0, 20) // Limit output
  });
};

// ============ Quality & Validation Handlers ============

export const handleAdminFindIncompleteTrips: AdminToolHandler = async (args, env) => {
  const { userId, requiredFields = ['clientName', 'destination', 'dates'] } = args;

  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (!summaries) {
    return json({ error: 'No trip summaries available' });
  }

  const incomplete: Array<{ tripId: string; userId: string; missingFields: string[] }> = [];

  for (const [tripId, summary] of Object.entries(summaries)) {
    if (userId && summary.userId !== userId) continue;

    const missing: string[] = [];
    for (const field of requiredFields) {
      const value = field.includes('.') ? getNestedValue(summary, field) : summary.meta?.[field];
      if (!value || (typeof value === 'string' && !value.trim())) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      incomplete.push({ tripId, userId: summary.userId, missingFields: missing });
    }
  }

  return json({
    requiredFields,
    incompleteCount: incomplete.length,
    incomplete: incomplete.slice(0, 50)
  });
};

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

export const handleAdminGetPublishHistory: AdminToolHandler = async (args, env) => {
  const { tripId, limit = 50 } = args;

  // Get activity records related to publishing
  const activities = await getRealtimeCalls(env, { limit: 200 });
  const publishActivities = activities.filter(a =>
    a.tool === 'publish_trip' || a.tool === 'preview_publish'
  );

  if (tripId) {
    const filtered = publishActivities.filter(a => a.metadata?.tripId === tripId);
    return json({
      tripId,
      publishCount: filtered.length,
      history: filtered.slice(0, limit).map(a => ({
        timestamp: a.timestamp,
        tool: a.tool,
        success: a.success,
        userId: a.userId,
        url: a.metadata?.url
      }))
    });
  }

  return json({
    totalPublishes: publishActivities.length,
    history: publishActivities.slice(0, limit).map(a => ({
      timestamp: a.timestamp,
      tool: a.tool,
      tripId: a.metadata?.tripId,
      success: a.success,
      userId: a.userId
    }))
  });
};

export const handleAdminGetPendingComments: AdminToolHandler = async (args, env) => {
  const { userId } = args;

  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (!summaries) {
    return json({ error: 'No trip summaries available' });
  }

  const pending: Array<{
    tripId: string;
    userId: string;
    clientName: string;
    destination: string;
    unreadCount: number;
  }> = [];

  for (const [tripId, summary] of Object.entries(summaries)) {
    if (userId && summary.userId !== userId) continue;
    if (!summary.unreadComments || summary.unreadComments === 0) continue;

    pending.push({
      tripId,
      userId: summary.userId,
      clientName: summary.meta?.clientName || 'Unknown',
      destination: summary.meta?.destination || 'Unknown',
      unreadCount: summary.unreadComments
    });
  }

  pending.sort((a, b) => b.unreadCount - a.unreadCount);

  return json({
    totalPendingComments: pending.reduce((sum, p) => sum + p.unreadCount, 0),
    tripsWithComments: pending.length,
    pending: pending.slice(0, 50)
  });
};

// ============ Direct Data Manipulation Handlers ============

export const handleAdminWriteKv: AdminToolHandler = async (args, env) => {
  const { key, value, confirm } = args;

  if (!key) {
    return text('Error: key is required');
  }

  if (!confirm) {
    return text('Error: confirm must be true. Direct KV writes can cause data corruption.');
  }

  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await env.TRIPS.put(key, stringValue);

    return json({
      success: true,
      key,
      size: stringValue.length,
      message: `Wrote ${stringValue.length} bytes to ${key}`
    });
  } catch (e: any) {
    return json({ success: false, error: e.message });
  }
};

export const handleAdminPatchTrip: AdminToolHandler = async (args, env) => {
  const { tripId, userId, patches } = args;

  if (!tripId || !userId || !patches) {
    return text('Error: tripId, userId, and patches are required');
  }

  const keyPrefix = getKeyPrefix(userId);
  const tripKey = `${keyPrefix}${tripId}`;

  const trip = await env.TRIPS.get(tripKey, 'json') as any;
  if (!trip) {
    return json({ success: false, message: `Trip not found: ${tripKey}` });
  }

  // Apply patches using dot notation
  const applied: string[] = [];
  for (const [path, value] of Object.entries(patches)) {
    setNestedValue(trip, path, value);
    applied.push(`${path} = ${JSON.stringify(value)}`);
  }

  await env.TRIPS.put(tripKey, JSON.stringify(trip));

  // Update summary if meta fields changed
  const summaries = await env.TRIPS.get('_trip_summaries', 'json') as Record<string, any> | null;
  if (summaries && summaries[tripId] && trip.meta) {
    summaries[tripId].meta = {
      clientName: trip.meta.clientName,
      destination: trip.meta.destination,
      dates: trip.meta.dates,
      phase: trip.meta.phase
    };
    await env.TRIPS.put('_trip_summaries', JSON.stringify(summaries));
  }

  return json({
    success: true,
    tripId,
    applied,
    message: `Applied ${applied.length} patches`
  });
};

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

// ============ Handler Map ============

export const adminHandlers: Record<string, AdminToolHandler> = {
  // Context - call first
  admin_get_context: handleAdminGetContext,
  // Read tools
  admin_get_overview: handleAdminGetOverview,
  admin_get_activity: handleAdminGetActivity,
  admin_get_tool_usage: handleAdminGetToolUsage,
  admin_get_user_analytics: handleAdminGetUserAnalytics,
  admin_get_user_segments: handleAdminGetUserSegments,
  admin_get_at_risk_users: handleAdminGetAtRiskUsers,
  admin_get_performance: handleAdminGetPerformance,
  admin_get_response_sizes: handleAdminGetResponseSizes,
  admin_get_revenue: handleAdminGetRevenue,
  admin_search_users: handleAdminSearchUsers,
  admin_search_trips: handleAdminSearchTrips,
  admin_send_message: handleAdminSendMessage,
  admin_send_broadcast: handleAdminSendBroadcast,
  admin_create_promo: handleAdminCreatePromo,
  admin_update_user: handleAdminUpdateUser,
  // Direct KV Access
  admin_read_kv: handleAdminReadKv,
  admin_list_kv_keys: handleAdminListKvKeys,
  admin_search_kv: handleAdminSearchKv,
  // Trip Admin
  admin_read_trip: handleAdminReadTrip,
  admin_delete_trip: handleAdminDeleteTrip,
  admin_transfer_trip: handleAdminTransferTrip,
  // User Data Access
  admin_get_user_trips: handleAdminGetUserTrips,
  admin_export_user_data: handleAdminExportUserData,
  // System Maintenance
  admin_get_storage_stats: handleAdminGetStorageStats,
  admin_get_orphaned_data: handleAdminGetOrphanedData,
  admin_cleanup_expired: handleAdminCleanupExpired,
  // Reference Data
  admin_list_references: handleAdminListReferences,
  admin_clear_reference: handleAdminClearReference,
  // Business Intelligence
  admin_get_conversion_funnel: handleAdminGetConversionFunnel,
  admin_get_destination_stats: handleAdminGetDestinationStats,
  admin_get_engagement_report: handleAdminGetEngagementReport,
  // Operational
  admin_clone_trip: handleAdminCloneTrip,
  admin_rebuild_indexes: handleAdminRebuildIndexes,
  admin_bulk_update_phase: handleAdminBulkUpdatePhase,
  // Quality & Validation
  admin_find_incomplete_trips: handleAdminFindIncompleteTrips,
  admin_get_publish_history: handleAdminGetPublishHistory,
  admin_get_pending_comments: handleAdminGetPendingComments,
  // Direct Data Manipulation
  admin_write_kv: handleAdminWriteKv,
  admin_patch_trip: handleAdminPatchTrip
};
