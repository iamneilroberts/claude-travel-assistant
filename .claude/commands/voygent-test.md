# Voygent AI Test Runner

Run QA tests with AI-generated personas against real Voygent MCP calls.

## Usage

```
/voygent-test                 # List scenarios
/voygent-test honeymoon       # Honeymoon trip test
/voygent-test disney          # Disney vacation test
/voygent-test honeymoon +visual   # Run with Codex visual review of preview
/voygent-test rocket          # Rocket launch viewing test
/voygent-test wine            # Wine country getaway test
/voygent-test got             # Game of Thrones locations test
/voygent-test cruise          # Cruise vacation test
/voygent-test beach           # Beach resort test
/voygent-test europe          # European city trip test
/voygent-test park            # National park test
/voygent-test ski             # Ski vacation test
```

## Available Scenarios

| Keyword | Trip Type | Natural Products |
|---------|-----------|------------------|
| `honeymoon` | Romantic getaway | Resort, flights, spa, romantic dinner |
| `disney` | Disney vacation | Park tickets, resort, dining plan |
| `rocket` | Launch viewing | Hotel, viewing tickets, KSC tour |
| `wine` | Wine country | Boutique hotel, tours, tastings, dining |
| `got` | GoT filming locations | Multi-city hotels, guided tours |
| `cruise` | Cruise vacation | Cabin, excursions, pre-cruise hotel |
| `beach` | Beach resort | All-inclusive, transfers, excursions |
| `europe` | European cities | Hotels, tours, trains, museums |
| `park` | National parks | Lodge, tours, car rental |
| `ski` | Ski vacation | Resort, lift tickets, rentals |
| `scuba` | Diving trip | Dive resort, packages, certification |
| `graduation` | Grad celebration | Hotels, activities, restaurants |
| `heritage` | Ancestry trip | Genealogy tours, cultural experiences |
| `music` | Music pilgrimage | Venue tours, show tickets, music districts |
| `culinary` | Food tour | Cooking classes, food tours, restaurants |
| `golf` | Golf vacation | Golf resort, tee times, club rental |
| `safari` | African safari | Safari lodge, game drives, park fees |
| `aurora` | Northern lights | Aurora lodges, viewing tours |
| `bachelor` | Bachelor/ette party | Group house, nightlife, activities |
| `babymoon` | Pre-baby trip | Relaxing resort, spa, romantic dining |
| `sports` | Sports event | Event tickets, nearby hotel |
| `bucket` | Bucket list | Guided tours, iconic site access |
| `train` | Train journey | Train tickets, stops, scenic routes |
| `islands` | Island hopping | Multi-island hotels, ferries |
| `roadtrip` | Scenic drive | Car rental, route stops, attractions |
| `festival` | Festival trip | Festival tickets, lodging, cultural |

## Options

- `+visual` - After generating preview, use Codex browser-use to visually inspect the rendered HTML and provide critique

## How It Works

Based on arguments: $ARGUMENTS

**Check for +visual flag:** If arguments contain "+visual", run Codex visual review after preview is generated.

### Step 1: Generate Persona

AI creates a unique persona for the trip type:
- Name and brief background
- Specific dates, budget, party size
- 1-2 realistic details (e.g., "celebrating 10th anniversary", "first trip with kids")
- Opening message they'd send

### Step 2: Run Conversational Test

Make REAL MCP calls to `https://voygent.somotravel.workers.dev/mcp` with key `TestRunner.test123`:

**IMPORTANT: Always start with `get_context`**

1. **Call `get_context` FIRST** - This returns the system prompt with trip schema, tool documentation, and data structure requirements. READ IT before making other calls.
2. Call `get_prompt("trip-schema")` to get the full trip data schema reference
3. Create trip with `save_trip` using the schema from the system prompt
4. Add details with `patch_trip` if needed
5. Generate preview with `preview_publish`

The system prompt tells you exactly how to structure trip data. Follow it.

**TRACK TIMING AND COSTS:** For each MCP call, record:
- Start time (before the call)
- Duration in milliseconds (after the call)
- Approximate size of request args (bytes)
- Approximate size of response (bytes)
- Success/failure status

This data will be used to estimate token usage and costs. See "Cost Tracking" section below.

**Quick Reference: Trip Data Structure**

The system prompt will explain this, but for reference - trip data MUST use this structure:

```json
{
  "meta": {
    "tripId": "honeymoon-johnson-2026",
    "title": "Maldives Honeymoon Escape",
    "clientName": "Michael & Sarah Johnson",
    "destination": "Maldives",
    "dates": "March 15-22, 2026",
    "phase": "proposal",
    "status": "Draft proposal"
  },
  "travelers": {
    "count": 2,
    "names": ["Michael Johnson", "Sarah Johnson"],
    "details": [...]
  },
  "dates": {
    "start": "2026-03-15",
    "end": "2026-03-22",
    "duration": 7
  },
  "budget": {...},
  "lodging": [...],
  "itinerary": [...],
  "tiers": {
    "value": {"name": "Value", "pricePerPerson": 3500, "highlights": [...]},
    "premium": {"name": "Premium", "pricePerPerson": 5000, "highlights": [...]},
    "luxury": {"name": "Luxury", "pricePerPerson": 8000, "highlights": [...]}
  }
}
```

**IMPORTANT**: The `meta` object is REQUIRED. The template uses `{{meta.clientName}}`, `{{meta.destination}}`, `{{meta.dates}}`, etc. Without proper `meta` structure, the preview will show empty hero section.

### Step 3: Visual Review (if +visual flag)

If `+visual` is in the arguments, invoke Codex to visually review the preview:

```
Use the /codex-review skill or spawn a Codex agent with browser-use capabilities:

"Open this URL in a browser: [PREVIEW_URL]

Take screenshots and analyze the rendered trip proposal:

1. VISUAL COMPLETENESS
   - Does the page render correctly (no broken layout)?
   - Are all sections visible (lodging, itinerary, pricing, maps)?
   - Do images/media load properly?

2. CONTENT MATCH
   - Does the destination match what was requested?
   - Are the dates correct?
   - Is the party size/traveler info accurate?
   - Are special requests reflected (e.g., 'glass floor bungalow')?

3. TRIP QUALITY
   - Does the itinerary look realistic and well-organized?
   - Are pricing tiers present and reasonable?
   - Would this proposal impress a real client?

4. ISSUES FOUND
   - List any visual bugs, missing sections, or data problems
   - Note anything that doesn't match the persona's requests

Output a structured critique with screenshots if helpful."
```

The Codex visual review output should be captured for the Judge to consider.

### Step 4: Evaluate & Save

Score the test (incorporating Codex visual feedback if +visual was used):
- **Task Completion** (40%): Trip created with required elements?
- **UX Quality** (25%): Natural conversation flow?
- **Data Quality** (20%): Trip data structured correctly? **If +visual: Does rendered output match data?**
- **Error Handling** (15%): Errors handled gracefully?

**If +visual was used:** The Judge should:
1. Review Codex's visual critique before finalizing scores
2. Adjust Data Quality score based on rendering issues
3. Include Codex findings in the `findings` array
4. Add Codex-suggested fixes to `suggestedFixes` field

Save to admin dashboard with this schema:

```json
{
  "id": "session-[scenario]-[timestamp]",
  "scenarioId": "[scenario]",
  "scenarioName": "[Trip Type] - [Persona Name]",
  "tier": 4,
  "startedAt": "[ISO]",
  "completedAt": "[ISO]",
  "persona": {
    "name": "[Name]",
    "experience": "new",
    "description": "[Brief background]"
  },
  "tripId": "[created trip ID]",
  "previewUrl": "[preview URL if generated]",
  "mcpCallCount": [number],
  "mcpSuccessCount": [number],
  "toolsUsed": ["get_context", "save_trip", ...],
  "transcript": "[FULL MCP call log - include each tool call with params and result summary]",

  "tokens": {
    "mcp": {
      "input": [total input tokens from MCP calls],
      "output": [total output tokens from MCP calls],
      "byTool": {
        "get_context": {"input": 100, "output": 5000, "calls": 1},
        "save_trip": {"input": 3000, "output": 200, "calls": 1}
      }
    },
    "reasoning": {
      "personaGeneration": [estimated tokens for persona creation],
      "tripPlanning": [estimated tokens for planning],
      "judgeAnalysis": [estimated tokens for evaluation]
    },
    "overhead": {
      "systemPrompt": 3000,
      "toolSchemas": 7500
    },
    "total": {
      "input": [total input],
      "output": [total output],
      "total": [grand total],
      "isEstimated": true
    }
  },
  "costEstimate": [total cost in USD - calculate using token counts],
  "modelUsed": "claude-opus-4-5-20251101",
  "mcpCallDetails": [
    {
      "seq": 1,
      "tool": "get_context",
      "argsPreview": "{}",
      "argsSize": 2,
      "success": true,
      "responseSize": 15000,
      "durationMs": 1200,
      "tokens": {"input": 100, "output": 3750},
      "cost": 0.0297,
      "timestamp": "[ISO timestamp]"
    }
  ],
  "reasoning": {
    "persona": "[Brief explanation of why you chose this persona]",
    "structure": "[Brief explanation of trip structure decisions]",
    "judge": "[Your evaluation reasoning]"
  },

  "visualReview": {
    "enabled": true/false,
    "codexFindings": [
      {"area": "layout|content|media|data", "issue": "...", "severity": "critical|warning|minor"}
    ],
    "screenshots": ["description of what was captured"],
    "overallAssessment": "pass|issues_found|fail",
    "suggestedFixes": [
      {"issue": "...", "fix": "...", "file": "optional file to fix"}
    ]
  },
  "judgeResult": {
    "scenarioId": "[scenario]",
    "passed": true/false,
    "scores": {
      "taskCompletion": [0-100],
      "uxQuality": [0-100],
      "dataQuality": [0-100],
      "errorHandling": [0-100],
      "overall": [weighted average]
    },
    "findings": [...],
    "proposedFAQs": [],
    "summary": "[2-3 sentences]"
  }
}
```

**Note:** The `visualReview` field is only populated when `+visual` flag is used.

**Transcript Format:**
Include all MCP calls in order. For each call:
```
[1] get_context()
    Result: Success - found 3 existing trips

[2] save_trip("honeymoon-johnson-2026", {...})
    Result: Success - trip created

[3] preview_publish("honeymoon-johnson-2026", "default")
    Result: Success - preview URL: https://somotravel.us/_preview/...
```

### Cost Tracking

**Token Estimation Formula:**
- Estimate tokens as: `Math.ceil(text.length / 4)` (roughly 4 chars per token)
- For each MCP call: input tokens from args JSON, output tokens from response JSON

**Cost Calculation (Claude Opus 4.5 pricing):**
- Input: $15 per million tokens
- Output: $75 per million tokens
- Formula: `cost = (inputTokens * 15 / 1_000_000) + (outputTokens * 75 / 1_000_000)`

**Example for get_context call:**
- Args: `{}` → 2 bytes → ~1 token input
- Response: 15,000 chars → ~3,750 tokens output
- Cost: `(1 * 15 / 1M) + (3750 * 75 / 1M) = $0.000015 + $0.28125 = ~$0.28`

**Overhead estimates to include:**
- System prompt: ~3,000 tokens
- Tool schemas: ~500 tokens × 15 tools = ~7,500 tokens

POST to: `https://voygent.somotravel.workers.dev/admin/test/sessions`
Admin key from `.env` line 3: `ede9dec4d517f9e0cfd6fdecb065eb495b0102dace78c34a`

## Test Environment

- **Auth Key:** TestRunner.test123
- **Blocked:** `publish_trip` (preview only)
- **Dashboard:** https://trial-641211be.voygent.ai/admin → QA Tests

Now running the test...
