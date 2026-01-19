# Admin Dashboard Enhancement Implementation Plan

## Overview

Enhance the Voygent admin dashboard with real-time activity visualization, cycling display modes, tool usage analytics, and an Admin MCP for conversational analytics via Claude Desktop.

## Goals

1. **Mission Control Dashboard** - Cycling display with Live → Replay → Stats → Insights modes
2. **Tool Usage Metrics** - Track and visualize which MCP tools are used
3. **Admin MCP** - Query Voygent analytics from Claude Desktop using your subscription
4. **Admin Actions** - Take action (message users, create promos) via Claude Desktop

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD (Web)                         │
│  Cycles through: Live Activity → Replay → Stats → Insights      │
│  Visual indicators for activity age, auto-advance toggle        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VOYGENT WORKER                                │
│                                                                  │
│  Existing:                    New:                               │
│  ├── /admin/*                 ├── /admin/activity-stream        │
│  ├── /admin/stats             ├── /admin/tool-metrics           │
│  └── /admin/activity          ├── /admin/performance            │
│                               └── /mcp (admin tools)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE KV                                 │
│                                                                  │
│  New Keys:                                                       │
│  ├── _metrics/tools/{YYYY-MM-DD}     Tool usage aggregates      │
│  ├── _metrics/realtime               Last 200 tool calls        │
│  ├── _metrics/performance/{YYYY-MM-DD} Response times           │
│  └── _metrics/errors/{YYYY-MM-DD}    Error log                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Tool Call Metrics Infrastructure

### 1.1 Create Metrics Library

**File:** `src/lib/metrics.ts`

```typescript
interface ToolCallMetric {
  timestamp: string;      // ISO string
  userId: string;
  tool: string;           // "save_trip", "get_context", etc.
  durationMs: number;
  success: boolean;
  errorType?: string;     // "validation", "not_found", "auth"
  metadata?: {
    tripId?: string;
    fieldsChanged?: string[];
    promptName?: string;
    templateName?: string;
  };
}

interface DailyToolMetrics {
  date: string;           // YYYY-MM-DD
  tools: {
    [toolName: string]: {
      count: number;
      successCount: number;
      errorCount: number;
      totalDurationMs: number;
      avgDurationMs: number;
      p95DurationMs: number;
      errors: { [errorType: string]: number };
    };
  };
  hourlyBreakdown: {
    [hour: string]: {     // "00" - "23"
      count: number;
      uniqueUsers: string[];
    };
  };
  uniqueUsers: string[];
  totalCalls: number;
}

interface RealtimeMetrics {
  calls: ToolCallMetric[];  // Last 200, newest first
  lastUpdated: string;
}
```

**Functions to implement:**

```typescript
// Record a single tool call (called from tool wrapper)
async function recordToolCall(
  env: Env,
  metric: ToolCallMetric
): Promise<void>

// Get daily aggregates
async function getDailyMetrics(
  env: Env,
  date: string  // YYYY-MM-DD
): Promise<DailyToolMetrics | null>

// Get realtime feed (last N calls)
async function getRealtimeCalls(
  env: Env,
  limit?: number  // default 50
): Promise<ToolCallMetric[]>

// Get metrics for date range
async function getMetricsRange(
  env: Env,
  startDate: string,
  endDate: string
): Promise<DailyToolMetrics[]>

// Get tool usage summary
async function getToolUsageSummary(
  env: Env,
  period: 'day' | 'week' | 'month'
): Promise<{
  tools: { name: string; count: number; pct: number; avgMs: number }[];
  totalCalls: number;
  uniqueUsers: number;
  peakHour: string;
}>
```

**Storage keys:**
- `_metrics/tools/{YYYY-MM-DD}` - Daily aggregates (30-day TTL)
- `_metrics/realtime` - Last 200 calls (no TTL, continuously updated)
- `_metrics/performance/{YYYY-MM-DD}` - Response time percentiles

### 1.2 Create Tool Call Wrapper

**File:** `src/mcp/metrics-wrapper.ts`

```typescript
// Wrap any tool handler to add metrics
function withMetrics<T>(
  env: Env,
  userId: string,
  toolName: string,
  handler: () => Promise<T>,
  metadata?: ToolCallMetric['metadata']
): Promise<T>
```

### 1.3 Update Tool Handlers

**File:** `src/mcp/tools/index.ts`

Wrap each tool handler call with metrics:

```typescript
// Before
const result = await handleSaveTrip(env, userId, args);

// After
const result = await withMetrics(env, userId, 'save_trip',
  () => handleSaveTrip(env, userId, args),
  { tripId: args.tripId }
);
```

### 1.4 Testing Phase 1

```bash
# Test 1: Verify metrics are recorded
# 1. Make several MCP tool calls via Claude
# 2. Check KV for _metrics/realtime
# 3. Verify call data is captured

# Test 2: Verify daily aggregation
# 1. Make 10+ tool calls
# 2. Check _metrics/tools/{today's date}
# 3. Verify counts and durations are aggregated

# Test 3: Verify error tracking
# 1. Trigger a validation error (save invalid trip)
# 2. Check that error is recorded with type

# Test 4: Performance impact
# 1. Time a save_trip call without metrics
# 2. Time with metrics wrapper
# 3. Confirm < 10ms overhead
```

---

## Phase 2: Admin Dashboard Cycling Display

### 2.1 Create Activity Stream Endpoint

**File:** `src/routes/admin/activity-stream.ts`

```typescript
// GET /admin/activity-stream?since={timestamp}&limit={n}
// Returns recent activity for live feed

interface ActivityStreamResponse {
  activities: {
    id: string;
    timestamp: string;
    userId: string;
    userEmail: string;
    tool: string;
    description: string;      // "saved trip 'Rome Adventure'"
    durationMs: number;
    success: boolean;
    ageSeconds: number;       // For client-side age styling
  }[];
  serverTime: string;         // For client clock sync
  activeUsers: number;        // Users active in last 5 min
}
```

### 2.2 Create Stats Summary Endpoint

**File:** `src/routes/admin/metrics-summary.ts`

```typescript
// GET /admin/metrics-summary?period={day|week|month}
// Returns aggregated stats for Stats view

interface MetricsSummaryResponse {
  period: string;
  overview: {
    activeUsers: number;
    newSignups: number;
    tripsCreated: number;
    tripsPublished: number;
    mrr: number;
    mrrChange: number;        // vs previous period
  };
  toolUsage: {
    name: string;
    count: number;
    pct: number;
    trend: 'up' | 'down' | 'flat';
  }[];
  performance: {
    avgResponseMs: number;
    p95ResponseMs: number;
    errorRate: number;
  };
  peakHours: { hour: number; count: number }[];
}
```

### 2.3 Create Insights Endpoint

**File:** `src/routes/admin/insights.ts`

```typescript
// GET /admin/insights
// Returns computed insights (no AI, rule-based)

interface InsightsResponse {
  atRiskUsers: {
    userId: string;
    email: string;
    daysSinceActive: number;
    previousActivityLevel: string;  // "high", "medium", "low"
    suggestedAction: string;
  }[];
  underusedFeatures: {
    tool: string;
    usagePercent: number;
    suggestion: string;
  }[];
  trends: {
    metric: string;
    direction: 'up' | 'down';
    percentChange: number;
    insight: string;
  }[];
  userSegments: {
    segment: string;          // "power", "regular", "light", "dormant"
    count: number;
    pctOfTotal: number;
  }[];
}
```

### 2.4 Update Admin Dashboard HTML

**File:** `src/admin-dashboard.ts`

Add cycling display with four modes:

```html
<!-- Mode selector tabs -->
<div class="mode-tabs">
  <button data-mode="live" class="active">● LIVE</button>
  <button data-mode="replay">⏱ REPLAY</button>
  <button data-mode="stats">📊 STATS</button>
  <button data-mode="insights">💡 INSIGHTS</button>
  <label class="auto-advance">
    <input type="checkbox" id="autoAdvance" checked>
    Auto-advance (30s)
  </label>
</div>

<!-- Live mode panel -->
<div id="panel-live" class="mode-panel active">
  <div class="live-header">
    <span class="pulse-dot"></span>
    <span>Active now: <strong id="activeCount">0</strong></span>
  </div>
  <div id="activity-feed" class="activity-feed">
    <!-- Activity items inserted here -->
  </div>
</div>

<!-- Replay mode panel -->
<div id="panel-replay" class="mode-panel">
  <div class="replay-header">
    <span>Replaying: <span id="replayTime">--</span></span>
    <input type="range" id="replaySpeed" min="1" max="20" value="10">
  </div>
  <div id="replay-feed" class="activity-feed">
    <!-- Replayed items here -->
  </div>
</div>

<!-- Stats mode panel -->
<div id="panel-stats" class="mode-panel">
  <!-- Stats cards and charts -->
</div>

<!-- Insights mode panel -->
<div id="panel-insights" class="mode-panel">
  <!-- At-risk users, trends, recommendations -->
</div>
```

**JavaScript functionality:**

```javascript
class MissionControl {
  constructor() {
    this.currentMode = 'live';
    this.autoAdvance = true;
    this.advanceInterval = 30000;  // 30 seconds
    this.modes = ['live', 'replay', 'stats', 'insights'];
    this.pollInterval = null;
    this.advanceTimer = null;
  }

  init() {
    this.bindEvents();
    this.startPolling();
    this.startAutoAdvance();
  }

  setMode(mode, userInitiated = false) {
    this.currentMode = mode;
    // Update UI, stop/start appropriate polling
    // If user clicked, disable auto-advance
    if (userInitiated) {
      this.autoAdvance = false;
      document.getElementById('autoAdvance').checked = false;
    }
  }

  advance() {
    if (!this.autoAdvance) return;
    const nextIndex = (this.modes.indexOf(this.currentMode) + 1) % this.modes.length;
    this.setMode(this.modes[nextIndex]);
  }

  // Age-based styling for activity items
  getAgeClass(ageSeconds) {
    if (ageSeconds < 30) return 'age-fresh';      // Green, pulsing
    if (ageSeconds < 120) return 'age-recent';    // Blue
    if (ageSeconds < 600) return 'age-stale';     // Gray, 70% opacity
    return 'age-old';                              // Gray, 50% opacity
  }
}
```

**CSS for age indicators:**

```css
.age-fresh {
  color: #22c55e;
  animation: pulse 2s infinite;
}
.age-fresh::before { content: '● '; }

.age-recent {
  color: #3b82f6;
}
.age-recent::before { content: '● '; }

.age-stale {
  color: #6b7280;
  opacity: 0.7;
}
.age-stale::before { content: '○ '; }

.age-old {
  color: #9ca3af;
  opacity: 0.5;
}
.age-old::before { content: '◌ '; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Replay mode has blue tint */
#panel-replay {
  background: linear-gradient(180deg, rgba(59,130,246,0.05) 0%, transparent 100%);
}

.replay-header {
  color: #3b82f6;
  font-style: italic;
}
```

### 2.5 Testing Phase 2

```bash
# Test 1: Live mode polling
# 1. Open admin dashboard
# 2. Make MCP calls from Claude
# 3. Verify activities appear within 3 seconds
# 4. Verify age indicators update correctly

# Test 2: Mode switching
# 1. Click each mode tab
# 2. Verify correct panel displays
# 3. Verify auto-advance disables on click
# 4. Re-enable auto-advance, verify cycling resumes

# Test 3: Replay mode
# 1. Let system idle for 5+ minutes
# 2. Verify auto-switch to replay
# 3. Verify historical events replay
# 4. Verify replay timestamp overlay shows

# Test 4: Stats mode
# 1. Navigate to stats panel
# 2. Verify tool usage breakdown displays
# 3. Verify performance metrics display
# 4. Verify peak hours chart renders

# Test 5: Insights mode
# 1. Create a dormant user (no activity 14+ days)
# 2. Navigate to insights panel
# 3. Verify at-risk user appears
# 4. Verify underused features listed
```

---

## Phase 3: Admin MCP Tools

### 3.1 Create Admin Tool Handlers

**File:** `src/mcp/tools/admin.ts`

```typescript
// Admin-only tools (require admin auth key)

export const adminTools = [
  // === READ TOOLS ===
  {
    name: 'admin_get_overview',
    description: 'Get system overview: active users, trips, revenue, health metrics',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'week', 'month', 'all'],
          default: 'week'
        },
        compare: {
          type: 'boolean',
          description: 'Include comparison to previous period',
          default: true
        }
      }
    }
  },
  {
    name: 'admin_get_activity',
    description: 'Get recent activity stream across all users',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'number', default: 24, description: 'Hours of history' },
        user: { type: 'string', description: 'Filter to specific user email' },
        tool: { type: 'string', description: 'Filter to specific tool name' },
        limit: { type: 'number', default: 50, maximum: 200 }
      }
    }
  },
  {
    name: 'admin_get_tool_usage',
    description: 'Get tool usage statistics - which tools are used most/least',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['day', 'week', 'month'], default: 'week' },
        group_by: { type: 'string', enum: ['tool', 'user', 'hour'], default: 'tool' }
      }
    }
  },
  {
    name: 'admin_get_user_analytics',
    description: 'Get detailed analytics for a specific user',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'User email address' }
      },
      required: ['email']
    }
  },
  {
    name: 'admin_get_user_segments',
    description: 'Get users grouped by engagement: power, regular, light, dormant',
    inputSchema: {
      type: 'object',
      properties: {
        include_users: {
          type: 'boolean',
          description: 'Include user list in each segment',
          default: false
        }
      }
    }
  },
  {
    name: 'admin_get_at_risk_users',
    description: 'Find users showing churn signals - inactive but previously engaged',
    inputSchema: {
      type: 'object',
      properties: {
        days_inactive: { type: 'number', default: 14 },
        min_previous_trips: { type: 'number', default: 1 }
      }
    }
  },
  {
    name: 'admin_get_performance',
    description: 'Get system performance metrics: response times, errors, latency',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['hour', 'day', 'week'], default: 'day' }
      }
    }
  },
  {
    name: 'admin_get_revenue',
    description: 'Get revenue metrics: MRR, subscriber counts, churn, growth',
    inputSchema: {
      type: 'object',
      properties: {
        include_subscribers: { type: 'boolean', default: false }
      }
    }
  },
  {
    name: 'admin_search_users',
    description: 'Search users by name, email, tier, or activity',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search name or email' },
        tier: { type: 'string', enum: ['trial', 'starter', 'professional', 'agency'] },
        status: { type: 'string', enum: ['active', 'trialing', 'past_due', 'canceled'] },
        min_trips: { type: 'number' },
        max_days_inactive: { type: 'number' }
      }
    }
  },
  {
    name: 'admin_search_trips',
    description: 'Search trips across all users',
    inputSchema: {
      type: 'object',
      properties: {
        destination: { type: 'string' },
        phase: { type: 'string', enum: ['proposal', 'confirmed', 'deposit_paid', 'paid_in_full', 'active', 'past'] },
        has_comments: { type: 'boolean' },
        published: { type: 'boolean' },
        limit: { type: 'number', default: 20 }
      }
    }
  },

  // === ACTION TOOLS ===
  {
    name: 'admin_send_message',
    description: 'Send a direct message to a user (appears in their Claude context)',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'User email' },
        message: { type: 'string', description: 'Message content' },
        priority: { type: 'string', enum: ['normal', 'high'], default: 'normal' }
      },
      required: ['email', 'message']
    }
  },
  {
    name: 'admin_send_broadcast',
    description: 'Send announcement to multiple users',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        target: { type: 'string', enum: ['all', 'paid', 'trial'], default: 'all' }
      },
      required: ['message']
    }
  },
  {
    name: 'admin_create_promo',
    description: 'Create a Stripe promo code',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Promo code (uppercase)' },
        percent_off: { type: 'number', minimum: 1, maximum: 100 },
        duration: { type: 'string', enum: ['once', 'repeating', 'forever'], default: 'once' },
        months: { type: 'number', description: 'Months if duration is repeating' },
        max_uses: { type: 'number', description: 'Maximum redemptions' }
      },
      required: ['code', 'percent_off']
    }
  },
  {
    name: 'admin_update_user',
    description: 'Update user settings (use carefully)',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        publish_limit: { type: 'number' },
        status: { type: 'string', enum: ['active', 'suspended'] },
        note: { type: 'string', description: 'Admin note about change' }
      },
      required: ['email']
    }
  }
];
```

### 3.2 Implement Admin Tool Handlers

**File:** `src/mcp/tools/admin-handlers.ts`

Implement each handler function:

```typescript
export async function handleAdminGetOverview(
  env: Env,
  args: { period: string; compare: boolean }
): Promise<object>

export async function handleAdminGetActivity(
  env: Env,
  args: { hours: number; user?: string; tool?: string; limit: number }
): Promise<object>

// ... etc for each tool
```

### 3.3 Register Admin Tools in MCP

**File:** `src/mcp/index.ts`

Add admin tools to tool list when admin-authenticated:

```typescript
// In tools/list handler
if (isAdminAuth) {
  tools.push(...adminTools);
}

// In tools/call handler
if (toolName.startsWith('admin_')) {
  if (!isAdminAuth) {
    return { error: 'Admin authentication required' };
  }
  return handleAdminTool(env, toolName, args);
}
```

### 3.4 Create Admin MCP Endpoint

**File:** `src/routes/admin/mcp.ts`

Separate MCP endpoint for admin access:

```typescript
// Handle MCP requests at /admin/mcp
// Requires X-Admin-Key header
// Returns only admin tools in tools/list
// Handles admin tool calls
```

### 3.5 Testing Phase 3

```bash
# Test 1: Admin auth required
# 1. Try calling admin_get_overview without admin key
# 2. Verify auth error returned
# 3. Add admin key header
# 4. Verify tool works

# Test 2: Claude Desktop integration
# 1. Add admin MCP to Claude Desktop config:
#    {
#      "mcpServers": {
#        "voygent-admin": {
#          "url": "https://voygent.somotravel.workers.dev/admin/mcp",
#          "transport": "sse",
#          "headers": { "X-Admin-Key": "your-admin-key" }
#        }
#      }
#    }
# 2. Restart Claude Desktop
# 3. Verify admin tools appear in tool list

# Test 3: Read tools
# 1. "Show me the system overview for this week"
# 2. "Which tools are used most?"
# 3. "Find users who haven't logged in for 2 weeks"
# 4. "Show me revenue metrics"
# Verify each returns expected data

# Test 4: Action tools
# 1. "Send a message to test@example.com saying hello"
# 2. Verify message appears in user's context
# 3. "Create a promo code SAVE20 for 20% off"
# 4. Verify code created in Stripe

# Test 5: Complex queries
# 1. "Compare this week to last week"
# 2. "Who are my power users?"
# 3. "What features should I promote more?"
# Verify Claude can synthesize insights from tool results
```

---

## Phase 4: Integration Testing

### End-to-End Test Scenarios

```bash
# Scenario 1: Full metrics flow
# 1. Clear metrics (or use test date range)
# 2. Make 20+ varied MCP calls as regular user
# 3. Open admin dashboard, verify Live mode shows calls
# 4. Switch to Stats, verify aggregates
# 5. Open Claude Desktop with admin MCP
# 6. Ask "What happened in the last hour?"
# 7. Verify response matches dashboard

# Scenario 2: At-risk user detection
# 1. Create test user, make several trips
# 2. Wait 14+ days (or manually set lastActive)
# 3. Open dashboard Insights panel
# 4. Verify user appears in at-risk list
# 5. Via Claude Desktop: "Who should I reach out to?"
# 6. Verify same user suggested
# 7. "Send them a check-in message"
# 8. Verify message delivered

# Scenario 3: Dashboard cycling
# 1. Open dashboard, enable auto-advance
# 2. Wait through full cycle (Live → Replay → Stats → Insights → Live)
# 3. Verify each mode displays correctly
# 4. Click a tab, verify auto-advance stops
# 5. Re-enable, verify cycling resumes

# Scenario 4: Replay mode activation
# 1. Stop all user activity
# 2. Wait 5 minutes
# 3. Verify dashboard auto-switches to Replay
# 4. Verify historical events replay with timestamps
# 5. Make new MCP call
# 6. Verify dashboard switches back to Live

# Scenario 5: Performance under load
# 1. Make 100 rapid MCP calls
# 2. Verify metrics recording doesn't cause errors
# 3. Verify dashboard remains responsive
# 4. Verify admin tools return within 2 seconds
```

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `src/lib/metrics.ts` | Metrics storage and aggregation |
| `src/mcp/metrics-wrapper.ts` | Tool call wrapper for metrics |
| `src/mcp/tools/admin.ts` | Admin tool definitions |
| `src/mcp/tools/admin-handlers.ts` | Admin tool implementations |
| `src/routes/admin/activity-stream.ts` | Real-time activity endpoint |
| `src/routes/admin/metrics-summary.ts` | Aggregated stats endpoint |
| `src/routes/admin/insights.ts` | Computed insights endpoint |
| `src/routes/admin/mcp.ts` | Admin MCP endpoint |

### Modified Files

| File | Changes |
|------|---------|
| `src/mcp/tools/index.ts` | Wrap tools with metrics |
| `src/mcp/index.ts` | Add admin tools when admin auth |
| `src/routes/admin/index.ts` | Add new admin routes |
| `src/admin-dashboard.ts` | Add cycling display, new panels |
| `src/types.ts` | Add metrics types |

---

## Deployment Checklist

1. [ ] Deploy metrics infrastructure (Phase 1)
2. [ ] Verify metrics recording in production
3. [ ] Deploy dashboard updates (Phase 2)
4. [ ] Test dashboard in production
5. [ ] Deploy admin MCP (Phase 3)
6. [ ] Configure Claude Desktop with admin MCP
7. [ ] Run integration tests (Phase 4)
8. [ ] Monitor for 24 hours
9. [ ] Document admin MCP usage for self

---

## Success Criteria

- [ ] Dashboard cycles through 4 modes smoothly
- [ ] Activity age indicators visually distinguish fresh vs old
- [ ] Replay mode activates after idle period
- [ ] Tool usage stats match actual usage
- [ ] Admin MCP accessible from Claude Desktop
- [ ] All admin read tools return accurate data
- [ ] Admin action tools work (message, promo)
- [ ] No noticeable performance impact on regular MCP calls
- [ ] Metrics storage stays under KV limits
