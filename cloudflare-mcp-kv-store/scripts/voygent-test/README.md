# Voygent Automated Testing System

An automated QA system using Claude Code subagents as simulated users to test Voygent, evaluate quality, and propose improvements.

## Quick Start

Run tests by asking Claude Code:

```
"Run the onboarding test scenario"
"Run the core Voygent tests"
"Run all Tier 2 tests"
```

View results:

```
"Show me the last 5 test results"
"Get the test statistics"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code Session                           │
│              "Run the onboarding test scenario"                  │
└────────────┬─────────────────────┬─────────────────┬────────────┘
             │                     │                 │
             ▼                     ▼                 ▼
┌────────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
│  Test Agent        │  │   Judge Agent    │  │  Results Storage    │
│  (Task subagent)   │  │  (Task subagent) │  │                     │
│                    │  │                  │  │ - KV: _test/runs/   │
│ Persona + scenario │  │ - Evaluates UX   │  │ - KV: _test/sessions/│
│ given, interacts   │  │ - Scores quality │  │                     │
│ with Voygent MCP   │  │ - Proposes fixes │  │                     │
└─────────┬──────────┘  └────────┬─────────┘  └──────────┬──────────┘
          │                      │                       │
          ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Voygent MCP Server (voygent-test DB)                │
│         POST /mcp?key=TestRunner.test123 → JSON-RPC 2.0          │
└─────────────────────────────────────────────────────────────────┘
```

## Test Scenarios

### Tier 1: Core Flows (Every Run)
| ID | Name | Description |
|----|------|-------------|
| `onboarding-fresh` | Fresh User Onboarding | New user discovers capabilities, accepts sample trips |
| `crud-basic` | Basic Trip CRUD | Create, read, update, delete trip operations |
| `publish-preview` | Publishing Flow | Preview trip publication (publish blocked) |

### Tier 2: Feature Coverage
| ID | Name | Description |
|----|------|-------------|
| `cruise-workflow` | Cruise Trip Workflow | Complex cruise with excursions and lodging |
| `multi-destination` | Multi-Destination Land Trip | Europe tour with multiple cities |
| `client-comments` | Client Comment Handling | Read and respond to client feedback |

### Tier 3: Edge Cases
| ID | Name | Description |
|----|------|-------------|
| `confused-user` | Confused User Navigation | User with wrong terminology |
| `error-recovery` | Error Recovery | Handle invalid requests gracefully |
| `support-escalation` | Support Request | Billing questions and support flow |

### Tier 4: Realistic User Scenarios
Real people with authentic life situations, natural speech patterns, and genuine concerns.

| ID | Name | Persona | Description |
|----|------|---------|-------------|
| `disney-busy-mom` | Busy Mom Plans Disney | Michelle Torres | Working nurse, 3 kids, budget-conscious, gets interrupted |
| `retiree-alaska-cruise` | Retirees Plan Alaska | Barbara & Jim Kowalski | 68yo couple, retirement dream trip, mobility concerns |
| `destination-wedding` | Destination Wedding | Aisha Johnson | 31yo planning Tulum wedding for 45 guests |
| `business-plus-leisure` | Business + Leisure | Kevin Okonkwo | VP of Sales adding Vietnam to Singapore conference |
| `gap-year-backpacker` | Gap Year Backpacker | Tyler Reyes | 24yo, $8000 for 6 weeks in Southeast Asia |
| `surprise-anniversary` | Surprise Anniversary | David Moreau | Planning secret 25th anniversary trip for wife |
| `family-reunion-chaos` | Family Reunion | Denise Washington | 32 people, ages 3-87, wheelchair accessibility needed |
| `solo-female-traveler` | Solo Female Trip | Priya Sharma | First solo trip after divorce, safety-conscious |
| `last-minute-panic` | Last Minute Panic | Brandon Kim | Forgot parents' 40th anniversary in 2 weeks |
| `group-trip-drama` | Girls Trip Drama | Stephanie Park | 8 women with conflicting preferences for Nashville |

## Test Environment Safety

- **Dedicated auth key**: `TestRunner.test123` - isolated from real users
- **Restricted tools**: Test agents cannot call `publish_trip` (server enforced)
- **7-day TTL**: All `_test/*` data auto-expires
- **Preview only**: Publishes go to R2 drafts, not production

## Admin API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/test/runs` | GET | List recent test runs |
| `/admin/test/runs` | POST | **Save a test run summary** |
| `/admin/test/sessions` | GET | List recent test sessions |
| `/admin/test/sessions` | POST | **Save a test session result** |
| `/admin/test/session/:id` | GET | Get session details |
| `/admin/test/run/:id` | GET | Get run details |
| `/admin/test/stats` | GET | Aggregate statistics |
| `/admin/test/proposed-faqs` | GET | FAQs suggested by tests |
| `/admin/test/faq/approve` | POST | Approve a proposed FAQ |
| `/admin/test/faq/dismiss` | POST | Dismiss a proposed FAQ |
| `/admin/test/cleanup` | DELETE | Manually clear test data |

### Saving Test Results

Test results MUST be saved via the admin API to appear in the dashboard:

```bash
# Save test session
curl -X POST "https://voygent.somotravel.workers.dev/admin/test/sessions" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d @session-result.json

# Save test run (aggregates multiple sessions)
curl -X POST "https://voygent.somotravel.workers.dev/admin/test/runs" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d @run-summary.json
```

## Judge Scoring Rubric

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Task Completion | 40% | Did the test complete its goals? |
| UX Quality | 25% | Was the experience intuitive? |
| Data Quality | 20% | Was data correctly structured? |
| Error Handling | 15% | Were errors handled gracefully? |

**Pass threshold**: Overall score ≥ 70 AND all required criteria met

## Files

```
scripts/voygent-test/
├── index.ts          # Barrel exports
├── scenarios.ts      # Test scenario definitions
├── mcp-client.ts     # MCP JSON-RPC client
├── prompts.ts        # Agent system prompts
├── results.ts        # Result types and KV storage
├── run.ts           # Main entry point and instructions
└── README.md        # This file
```

## KV Storage

```
_test/config              - System configuration
_test/runs/{runId}        - Test run summaries
_test/sessions/{id}       - Full session transcripts
_test/analysis/{date}     - Daily aggregated analysis
```

## Adding New Scenarios

1. Add a new scenario to `scenarios.ts`:

```typescript
{
  id: 'my-new-scenario',
  name: 'My New Test',
  tier: 2,
  persona: PERSONAS.experiencedAgent,
  task: `Description of what the test agent should do...`,
  maxTurns: 12,
  successCriteria: {
    required: ['criterion 1', 'criterion 2'],
    bonus: ['nice to have']
  },
  restrictedTools: ['publish_trip']
}
```

2. Add to the appropriate tier array (CORE_SCENARIOS, FEATURE_SCENARIOS, or EDGE_CASE_SCENARIOS)

3. Test by running: "Run the my-new-scenario test"

## Troubleshooting

**Test agent can't authenticate**
- Verify `TestRunner.test123` key exists in voygent-test KV
- Check the test URL is accessible

**Judge returns invalid JSON**
- Check the transcript isn't too long (may cause truncation)
- Verify the judge prompt is correctly formatted

**Results not saving**
- Verify admin key is set for KV writes
- Check KV namespace bindings
