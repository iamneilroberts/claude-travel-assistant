# Voygent Testing Guide

A quick walkthrough to test the travel assistant features.

---

## Setup

1. Open Claude (claude.ai) or ChatGPT with Voygent MCP tool connected
2. Start a new conversation

---

## Test 1: Initialize Session

**Say:** "Use voygent"

**Expected:** Claude calls `get_context` and displays a welcome card showing:
- Last activity
- Active trips count
- Quick commands list

---

## Test 2: List Existing Trips

**Say:** "Show my trips"

**Expected:** List of trip IDs currently stored in your account.

---

## Test 3: Create a New Trip

**Say:** "I want to plan a weekend trip to Nashville for 2 people in March"

**Expected:** Claude should:
1. Ask a few discovery questions (dates, budget, interests)
2. Create and save a new trip with proper schema
3. Confirm the trip was saved

**Verify:** Say "list trips" - your new trip should appear.

---

## Test 4: Read a Trip

**Say:** "Show me the details of [trip-id]"

**Expected:** Full trip JSON displayed with all sections (meta, travelers, dates, etc.)

---

## Test 5: Update a Trip

**Say:** "Add a note that we want to visit the Country Music Hall of Fame"

**Expected:** Claude uses `patch_trip` or `save_trip` to update the trip and confirms the change.

**Verify:** Say "show the trip again" - your change should be there.

---

## Test 6: Validate a Trip

**Say:** "Validate the [trip-id] trip"

**Expected:** Claude calls `validate_trip` and returns a report with:
- Critical Issues (must fix)
- Warnings (should address)
- Suggestions (nice to have)
- Missing Information
- Trip Strengths

The AI analyzes logistics, timing, missing data, budget alignment, and seasonal factors.

---

## Test 7: List Templates

**Say:** "What templates are available for publishing?"

**Expected:** Returns list including:
- `default` (green theme)
- `somotravel-cruisemasters` (Cruise Planners branded)

---

## Test 8: Preview a Trip

**Say:** "Preview the [trip-id] trip"

**Expected:**
- Claude calls `preview_publish`
- Returns a clickable URL like: `https://somotravel.us/drafts/[trip-id].html`
- You can click the link to see the rendered HTML

**Verify:** Open the URL in your browser - you should see a formatted trip page.

---

## Test 9: Preview with Different Template

**Say:** "Preview [trip-id] using the somotravel-cruisemasters template"

**Expected:**
- Returns a preview URL
- Page should have blue/teal Cruise Planners branding instead of green

---

## Test 10: Publish a Trip

**Say:** "Publish [trip-id] as a proposal"

**Expected:**
- Claude calls `publish_trip` with category "proposal"
- Returns URL like: `https://somotravel.us/[trip-id].html`
- Trip appears on somotravel.us index page under "Proposal" category

**Verify:**
1. Open the returned URL
2. Visit https://somotravel.us - trip should be listed

---

## Test 11: Delete a Trip

**Say:** "Delete the [trip-id] trip"

**Expected:** Confirmation that trip was deleted.

**Verify:** "List trips" - deleted trip should no longer appear.

---

## Quick Command Tests

Try these shortcuts:

| Say This | Expected Result |
|----------|-----------------|
| "my trips" | List all trips |
| "status" | Current trip phase and what's missing |
| "next" | Single most important next action |
| "quote check" | What's needed to make trip quotable |
| "profitability" | Commission estimates and upsell suggestions |
| "hand-over" | Summary for booking follow-up |

---

## Roadmap Feature Tests

### Test: Tiered Proposals

**Setup:** Have or create a trip with some basic info (destination, dates, travelers).

**Say:** "Create tiered options for my [trip-id] trip"

**Expected:**
- Claude adds a `tiers` object with `value`, `premium`, and `luxury` options
- Each tier has: name, description, lodging, flights, extras, estimatedTotal
- Tiers should have meaningfully different price points

**Verify:** Preview or publish the trip - should show 3 side-by-side tier cards with:
- Tier names (e.g., "Essential", "Comfort Plus", "Luxury")
- Brief descriptions
- Price estimates
- Premium tier highlighted as "Recommended"

---

### Test: Quote Import

**Say:** "Import this quote into my [trip-id] trip:

Royal Caribbean Confirmation #ABC123
Adventure of the Seas
Sailing: October 15-22, 2026
Interior Stateroom - Deck 6
Guest: John Smith
Total: $1,847.23 per person"

**Expected:**
- Claude calls `import_quote` tool
- AI parses: confirmation number, dates, supplier, prices
- Trip is updated with real data
- Flags any discrepancies vs. planned itinerary

**Verify:** Read the trip - should show updated pricing/confirmation data.

---

### Test: QR Code

**Say:** "Publish [trip-id] as a proposal"

**Expected:** After publishing, view the page.

**Verify:** Scroll to the footer - should show a QR code that links to the page itself. Scan with your phone to confirm.

---

### Test: YouTube Video Embeds

**Proactive (Claude searches):**
**Say:** "Find some helpful YouTube videos about Rome for my trip"

**Expected:** Claude searches YouTube, finds relevant videos, extracts video IDs, and adds them to the trip's `media` array.

**Manual add:**
**Say:** "Add this YouTube video to my trip: https://youtube.com/watch?v=dQw4w9WgXcQ with caption 'Walking tour'"

**Disable videos:**
**Say:** "Remove the videos from this trip"

**Expected:** Claude sets `meta.showVideos: false`

**Verify:** Preview - "Helpful Videos" section should appear (or not, if disabled).

---

### Test: Google Maps

**Basic (auto):** If trip has `meta.destination`, a single map appears automatically.

**Multiple maps:**
**Say:** "Add maps for the hotel and the Colosseum to my trip"

**Expected:** Claude adds a `maps` array with labeled locations.

**Verify:** Preview shows multiple maps with labels like "Your Hotel", "Colosseum".

**Disable maps:**
**Say:** "Remove the maps from this trip"

**Expected:** Claude sets `meta.showMaps: false`

**Verify:** Preview shows no maps.

---

### Test: Profitability Analysis

**Say:** "Analyze the profitability of my [trip-id] trip"

**Expected:** Claude calls `analyze_profitability` and returns:
- Estimated commissions by product type (cruise, hotel, insurance, etc.)
- Commission rate ranges used
- Identified gaps (e.g., "No travel insurance - potential $200+ commission")
- Suggested upsells with commission impact
- Service fee recommendation based on trip complexity

**Advanced test:** "Analyze profitability for [trip-id] with a target of $500"

**Expected:** Additional section showing what to add/upsell to reach $500 commission target.

---

## Error Cases to Test

### Wrong Template Name
**Say:** "Preview trip using the 'cruiseplanners' template"

**Expected:** Error message that template not found. Claude should suggest calling `list_templates` first.

### Non-existent Trip
**Say:** "Show me the trip called fake-trip-12345"

**Expected:** Error message that trip not found.

---

## Publishing Categories

When publishing, you can specify these categories:

| Category | Use Case |
|----------|----------|
| `testing` | Development/test trips (default) |
| `proposal` | Client proposals |
| `confirmed` | Confirmed bookings |
| `deposit_paid` | Deposit received |
| `paid_in_full` | Fully paid |
| `active` | Currently traveling |
| `past` | Completed trips |

**Example:** "Publish my-trip as confirmed"

---

## Things to Watch For

- **Schema compliance**: New trips should have `lodging` and `itinerary` as arrays
- **Day numbering**: Published pages should show "Day 1", "Day 2" (not 0, 1, 2)
- **No raw HTML**: Claude should NEVER write HTML directly - always use the tools
- **Template names**: Claude should call `list_templates` before guessing names

---

## Cleanup

After testing, you can:
1. Delete test trips: "Delete [trip-id]"
2. Visit https://somotravel.us and use "Clean Up Index" to remove orphaned entries

---

## Report Issues

If something doesn't work as expected, note:
1. What you said
2. What Claude did (tool calls)
3. What went wrong
4. Screenshot if possible
