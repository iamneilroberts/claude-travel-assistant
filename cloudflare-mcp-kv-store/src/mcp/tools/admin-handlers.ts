/**
 * Admin MCP Tool Handlers
 * Implementation of admin tools for the /admin/mcp endpoint
 */

import type { Env, UserProfile } from '../../types';
import {
  getRealtimeCalls,
  getToolUsageSummary,
  computeInsights
} from '../../lib/metrics';

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

async function getAllUsers(env: Env): Promise<UserProfile[]> {
  const list = await env.TRIPS.list({ prefix: '_profile/' });
  const users: UserProfile[] = [];

  for (const key of list.keys) {
    const profile = await env.TRIPS.get(key.name, 'json') as UserProfile | null;
    if (profile) users.push(profile);
  }

  return users;
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
        p95ResponseMs: stats.p95DurationMs
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

  return json({
    period: summary.period,
    overview: {
      totalCalls: summary.totalCalls,
      errorRate: Math.round(summary.errorRate * 10) / 10 + '%',
      peakHour: summary.peakHour
    },
    slowOperations: slowTools,
    errorProneTools: errorTools,
    toolPerformance: Object.entries(summary.tools)
      .map(([name, stats]) => ({
        name,
        calls: stats.count,
        avgMs: stats.avgDurationMs,
        p95Ms: stats.p95DurationMs,
        successRate: Math.round(stats.successRate) + '%'
      }))
      .sort((a, b) => b.calls - a.calls)
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

// ============ Handler Map ============

export const adminHandlers: Record<string, AdminToolHandler> = {
  admin_get_overview: handleAdminGetOverview,
  admin_get_activity: handleAdminGetActivity,
  admin_get_tool_usage: handleAdminGetToolUsage,
  admin_get_user_analytics: handleAdminGetUserAnalytics,
  admin_get_user_segments: handleAdminGetUserSegments,
  admin_get_at_risk_users: handleAdminGetAtRiskUsers,
  admin_get_performance: handleAdminGetPerformance,
  admin_get_revenue: handleAdminGetRevenue,
  admin_search_users: handleAdminSearchUsers,
  admin_search_trips: handleAdminSearchTrips,
  admin_send_message: handleAdminSendMessage,
  admin_send_broadcast: handleAdminSendBroadcast,
  admin_create_promo: handleAdminCreatePromo,
  admin_update_user: handleAdminUpdateUser
};
