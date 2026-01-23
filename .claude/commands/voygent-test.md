# Voygent AI Test Runner

Run automated QA tests against Voygent using AI-powered test agents.

## Usage

```
/voygent-test                    # Show available scenarios
/voygent-test disney             # Run the Disney busy mom test
/voygent-test tier4              # Run all Tier 4 realistic tests
/voygent-test anniversary        # Run surprise anniversary test
```

## How This Works

1. **Test Agent** (Task subagent) role-plays as a realistic user persona
2. Makes **real MCP calls** to Voygent (same as production Claude.ai)
3. **Judge Agent** evaluates the transcript and scores the experience
4. Results saved to admin dashboard with preview links

## Available Scenarios

### Tier 1: Core Flows
- `onboarding` - Fresh user discovers Voygent
- `crud` - Create, read, update, delete trips
- `publish` - Preview publishing workflow

### Tier 4: Realistic User Personas
- `disney` - Michelle Torres, busy mom planning Disney with 3 kids
- `alaska` or `retiree` - Barbara & Jim Kowalski, retirement dream cruise
- `wedding` - Aisha Johnson, destination wedding in Tulum (45 guests)
- `business` - Kevin Okonkwo, adding Vietnam to Singapore conference
- `backpacker` - Tyler Reyes, 6-week Southeast Asia gap year
- `anniversary` - David Moreau, secret 25th anniversary surprise
- `reunion` - Denise Washington, 32-person family reunion
- `solo` - Priya Sharma, first solo trip after divorce
- `panic` - Brandon Kim, forgot parents' 40th anniversary (2 weeks out!)
- `girls-trip` - Stephanie Park, 8 women Nashville bachelorette

## Running the Test

I'll now run the requested scenario using this process:

### Step 1: Identify Scenario

Based on arguments: $ARGUMENTS

If no arguments provided, list available scenarios and ask which to run.

### Step 2: Spawn Conversational Test Agent

The Test Agent will:
- Role-play as the persona (speaking naturally, NOT knowing tool names)
- Start a conversation like a real user would on Claude.ai
- Respond to assistant questions with realistic answers
- React authentically (confusion, satisfaction, frustration)

The Voygent Assistant will:
- Call `get_context` FIRST (required by system prompt)
- Ask clarifying questions before creating trips
- Use `save_trip`, `patch_trip`, `preview_publish` naturally
- Make REAL HTTP calls to https://voygent.somotravel.workers.dev/mcp?key=TestRunner.test123

### Step 3: Run Judge Agent

After conversation completes, evaluate:
- **Task Completion** (40%): Did the persona achieve their goals?
- **UX Quality** (25%): Was the experience intuitive?
- **Data Quality** (20%): Was trip data correctly structured?
- **Error Handling** (15%): Were errors handled gracefully?

Pass threshold: Overall >= 70 AND all required criteria met

### Step 4: Save Results

POST to admin dashboard:
```bash
curl -X POST "https://voygent.somotravel.workers.dev/admin/test/sessions" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d @session-result.json
```

Admin key from: /home/neil/dev/claude-travel-assistant/.env

### Step 5: Report Results

Show:
- Pass/Fail status
- Scores breakdown
- Key findings (positive and negative)
- Preview URL if trip was created
- Link to admin dashboard for full transcript

## Test Environment

- **Auth Key**: TestRunner.test123 (isolated from real users)
- **Restrictions**: Cannot call `publish_trip` (preview only)
- **Data TTL**: Test data expires after 7 days
- **Dashboard**: Check results at https://trial-641211be.voygent.ai/admin → QA Tests tab

## Example Conversation Flow

```
=== TURN 1 ===
[USER - Michelle (Busy Mom)]:
"Hi! I need help planning a Disney trip for my kids. We've never been and
I'm kinda overwhelmed lol. 3 kids - 5, 8, and 11. Spring break maybe?"

[ASSISTANT calls get_context, then responds]:
"I'd be happy to help plan your first Disney trip! Before I create your
trip, a few questions:
1. What dates during spring break?
2. What's your budget?
3. Flying or driving?"

[TOOL CALLS]: get_context() → Success

=== TURN 2 ===
[USER - Michelle]:
"March 14-17ish? Trying to keep it under $5000 for everything. Flying from
Dallas. Oh and my 5yo is really into princesses, the 11yo wants thrill rides"

[ASSISTANT calls save_trip]:
"Perfect! I've started your Disney trip..."

[TOOL CALLS]: save_trip(disney-torres-2026, {...}) → Success
```

Now running the test...
