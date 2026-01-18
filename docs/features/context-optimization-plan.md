# Context Optimization Implementation Plan

## Goal

Reduce token usage and improve response speed for the Voygent MCP server while maintaining full AI capabilities.

## Overview

Five optimizations in priority order:

1. **Shorten tool descriptions** - Reduce tokens sent with every request
2. **Strip nulls from tool responses** - Reduce tokens in every response
3. **Update system prompt** - Behavioral changes to prefer efficient patterns
4. **Add read_trip_section tool** - Granular data fetching
5. **Trim get_context payload** - Reduce startup context

---

## 1. Shorten Tool Descriptions

**File:** `src/mcp/tool-definitions.ts`

**Current Problem:** Tool descriptions include examples, usage notes, and verbose explanations. These are sent with every MCP request, costing ~500-1000 tokens.

**Implementation:**

For each tool, reduce description to 1 concise sentence. Move examples to `prompts/system-prompt.md` if needed.

### Before/After Examples

```typescript
// BEFORE
{
  name: "save_trip",
  description: "Save or update a trip JSON file. Use this to create new trips or make major updates. For small changes like updating status or adding a single field, prefer patch_trip instead as it's faster and safer.",
  ...
}

// AFTER
{
  name: "save_trip",
  description: "Create or fully replace a trip. Use patch_trip for small updates.",
  ...
}
```

```typescript
// BEFORE
{
  name: "prepare_image_upload",
  description: "PREFERRED method for user image uploads. Generates an upload link for the user to add images via web browser. Much more reliable than base64. Returns both the upload URL (for user to click) and the final image URL (which you can use immediately after user confirms upload). User says 'add a photo' → call this → give them the link → wait for 'done' → use the imageUrl.",
  ...
}

// AFTER
{
  name: "prepare_image_upload",
  description: "Generate upload link for user to add images via browser.",
  ...
}
```

### Tools to Shorten

| Tool | Current ~chars | Target ~chars |
|------|----------------|---------------|
| get_context | 120 | 60 |
| list_trips | 80 | 40 |
| read_trip | 70 | 40 |
| save_trip | 180 | 60 |
| patch_trip | 250 | 80 |
| delete_trip | 40 | 30 |
| list_templates | 80 | 40 |
| preview_publish | 180 | 60 |
| publish_trip | 120 | 60 |
| validate_trip | 150 | 60 |
| import_quote | 150 | 60 |
| analyze_profitability | 120 | 60 |
| get_prompt | 200 | 60 |
| get_comments | 100 | 50 |
| get_all_comments | 80 | 50 |
| dismiss_comments | 120 | 50 |
| submit_support | 180 | 60 |
| reply_to_admin | 120 | 50 |
| dismiss_admin_message | 120 | 50 |
| add_trip_image | 200 | 60 |
| prepare_image_upload | 350 | 60 |
| youtube_search | 150 | 50 |

**Verification:**
- Run `npm run deploy`
- Test MCP connection still works
- Verify tool descriptions are concise in Claude's tool list

---

## 2. Strip Nulls from Tool Responses

**Files:** All tool handlers in `src/mcp/tools/*.ts`

**Current Problem:** Tool responses include empty arrays, null values, and unchanged fields. Example:

```json
{
  "flights": null,
  "bookings": [],
  "media": [],
  "featuredLinks": null,
  "tiers": null
}
```

**Implementation:**

Create a utility function and apply to all tool responses:

### Add Utility Function

**File:** `src/lib/utils.ts` (create if doesn't exist)

```typescript
/**
 * Recursively remove null, undefined, and empty arrays from an object
 */
export function stripEmpty(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    if (obj.length === 0) return undefined;
    return obj.map(stripEmpty).filter(v => v !== undefined);
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const stripped = stripEmpty(value);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return obj;
}
```

### Apply to Tool Handlers

Update each tool handler that returns JSON data:

```typescript
// In src/mcp/tools/trips.ts - handleReadTrip
import { stripEmpty } from '../../lib/utils';

// Before returning:
const result = stripEmpty(tripData);
return {
  content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
};
```

**Tools to Update:**
- `handleReadTrip` in `trips.ts`
- `handleListTrips` in `trips.ts`
- `handleGetContext` in `get-context.ts`
- `handleGetComments` in `comments.ts`
- `handleGetAllComments` in `comments.ts`
- `handleValidateTrip` in `validation.ts`
- `handleAnalyzeProfitability` in `validation.ts`

**Verification:**
- Read a trip with empty sections, verify nulls are stripped
- Check response size is smaller

---

## 3. Update System Prompt for Efficient Patterns

**File:** `prompts/system-prompt.md`

**Implementation:**

Add a new section after "## Saving Trips":

```markdown
## Efficiency Guidelines

**Minimize data fetching:**
- Use `list_trips` with summaries before reading full trips
- For "show me the trip" requests, offer the preview/published URL first:
  "Here's the current proposal: [preview URL]. Want me to load the details for editing?"
- Only call `read_trip` when the user needs to edit or review specific data

**Prefer small updates:**
- Use `patch_trip` for any change that touches ≤3 fields
- Only use `save_trip` for structural changes (rebuilding itinerary, new sections)

**Section-focused work:**
- When user asks about flights, only discuss flights section
- When user asks about Day 3, reference only that day's data
- Avoid dumping entire trip contents unless asked
```

**Verification:**
- Upload updated system prompt to KV
- Test that Claude offers preview URLs and uses patch_trip

---

## 4. Add read_trip_section Tool

**Files:**
- `src/mcp/tool-definitions.ts` - Add tool definition
- `src/mcp/tools/trips.ts` - Add handler
- `src/mcp/index.ts` - Register handler

### Tool Definition

Add to `TOOL_DEFINITIONS` array:

```typescript
{
  name: "read_trip_section",
  description: "Read specific sections of a trip. More efficient than loading full trip.",
  inputSchema: {
    type: "object",
    properties: {
      tripId: {
        type: "string",
        description: "The trip ID"
      },
      sections: {
        type: "array",
        items: {
          type: "string",
          enum: ["meta", "travelers", "dates", "budget", "flights", "lodging", "itinerary", "tiers", "media", "bookings", "featuredLinks", "cruiseInfo"]
        },
        description: "Sections to retrieve"
      },
      itineraryDay: {
        type: "number",
        description: "If sections includes 'itinerary', optionally fetch only this day number"
      }
    },
    required: ["tripId", "sections"]
  }
}
```

### Handler Implementation

Add to `src/mcp/tools/trips.ts`:

```typescript
export const handleReadTripSection: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, sections, itineraryDay } = args;

  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json") as any;

  if (!tripData) {
    throw new Error(`Trip '${tripId}' not found.`);
  }

  // Build partial response with only requested sections
  const result: any = { tripId };

  for (const section of sections) {
    if (tripData[section] !== undefined) {
      if (section === 'itinerary' && itineraryDay !== undefined) {
        // Return only the specific day
        const day = tripData.itinerary?.find((d: any) => d.day === itineraryDay);
        result.itinerary = day ? [day] : [];
      } else {
        result[section] = tripData[section];
      }
    }
  }

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};
```

### Register Handler

In `src/mcp/index.ts`, add to `toolHandlers`:

```typescript
import { handleReadTripSection } from './tools/trips';

export const toolHandlers: Record<string, McpToolHandler> = {
  // ... existing handlers
  read_trip_section: handleReadTripSection,
};
```

**Verification:**
- Test `read_trip_section(tripId, ["meta", "flights"])`
- Test `read_trip_section(tripId, ["itinerary"], itineraryDay=3)`
- Verify response only contains requested sections

---

## 5. Trim get_context Payload

**File:** `src/mcp/tools/get-context.ts`

**Current Problem:** `get_context` returns:
- Full system prompt (~3000 tokens)
- Full activity log
- Full comment bodies for all active comments
- All trip summaries

**Implementation:**

### 5.1 Return Comment Counts Only

Replace full comment details with counts:

```typescript
// BEFORE
activeComments: totalActiveComments > 0 ? {
  total: totalActiveComments,
  newCount: newCommentCount,
  details: activeComments  // Full comment bodies
} : null,

// AFTER
activeComments: totalActiveComments > 0 ? {
  total: totalActiveComments,
  newCount: newCommentCount,
  trips: activeComments.map(c => ({
    tripId: c.tripId,
    count: c.comments.length,
    hasNew: c.comments.some(cm => cm.isNew)
  }))
  // Note: Use get_comments(tripId) for full details
} : null,
```

### 5.2 Compact Activity Log

Limit recent changes to last 5 items:

```typescript
// In get-context.ts
const activityLog = await env.TRIPS.get(keyPrefix + "_activity-log", "json") || {
  lastSession: null,
  recentChanges: [],
  openItems: [],
  tripsActive: []
};

// Trim to last 5 changes
if (activityLog.recentChanges?.length > 5) {
  activityLog.recentChanges = activityLog.recentChanges.slice(0, 5);
}
```

### 5.3 Limit Trip Summaries

Only return top 10 most recently modified trips:

```typescript
// Sort by lastModified and take top 10
const sortedTrips = activeTripSummaries
  .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
  .slice(0, 10);

// Include note if more exist
const result = {
  // ...
  activeTripSummaries: sortedTrips,
  totalTripsCount: activeTripSummaries.length,
  // ...
};
```

### 5.4 Add Instruction to Use Tools for Details

Update the `_instruction` field:

```typescript
_instruction: "Use the following as your system instructions. For full comment details, use get_comments(tripId). For full trip data, use read_trip(tripId) or read_trip_section(tripId, sections)."
```

**Verification:**
- Call `get_context` and verify response is smaller
- Verify comment counts work, full details via `get_comments`
- Verify only 10 trip summaries returned

---

## Testing Checklist

After implementing all changes:

- [ ] Deploy worker: `npm run deploy`
- [ ] Upload updated system prompt to KV
- [ ] Test tool descriptions are concise
- [ ] Test read_trip returns no nulls/empty arrays
- [ ] Test read_trip_section with various section combinations
- [ ] Test get_context returns compact data
- [ ] Test full workflow: list trips → read section → patch → publish
- [ ] Measure token reduction (before/after comparison)

## Expected Token Savings

| Optimization | Estimated Savings |
|--------------|-------------------|
| Shorter tool descriptions | 500-1000 tokens/request |
| Strip nulls | 200-500 tokens/response |
| System prompt changes | Behavioral (compounds) |
| read_trip_section | 500-2000 tokens when used |
| Trim get_context | 300-800 tokens/startup |

**Total estimated savings:** 30-50% reduction in typical conversation token usage.
