# Context Optimization Test Plan

## Objectives
- Reduce token usage at startup and during trip work.
- Improve response latency without losing accuracy.
- Preserve full-trip access when needed.

## Proposed Optimizations

### Tool Loading + Descriptions
- Load only core tools at startup: `get_context`, `list_trips`, `read_trip`, `patch_trip`.
- Defer tools: publish, images, youtube, support.
- Shorten tool descriptions; move examples to docs.

### Context Payload Reduction
- `get_context` returns counts and short summaries by default.
- Full comment bodies only via `get_comments`.
- Include trip summaries instead of full trip data.

### Partial Trip Access
- Add `read_trip_section` or `read_trip_fields`.
- Fetch only `meta`, `dates`, `travelers`, `budget`, `bookings`, or a single day.
- Add last-modified section tracking.

### Workflow Defaults
- For "view trip", offer preview/published HTML before full JSON.
- Prefer `patch_trip` for small changes.
- Ask a clarifying question before loading full itinerary.

### Response Shaping
- Remove nulls and redundant fields in tool responses.
- Store a compact itinerary summary for list views.

### Performance
- Parallelize KV reads where possible.
- Expand indexing for summaries and pending deletes.

## Test Matrix

### Startup
- Measure tokens for `get_context` before/after optimization.
- Verify only core tools are loaded initially.

### Listing Trips
- `list_trips` returns IDs + summaries by default.
- Confirm summaries are used unless full trip is requested.

### View Trip
- Ask to view trip -> preview/published HTML offered first.
- If user accepts, avoid loading trip JSON.
- If edits requested, load only required sections.

### Edit Trip
- Small update -> `patch_trip` uses minimal fields.
- Major update -> `save_trip` allowed.

### Comments
- `get_context` includes only comment counts.
- `get_comments` returns full comment payload.

### Regression
- All existing tools still callable when needed.
- No breakage in publish flow.

## Success Criteria
- Startup token usage reduced by at least 40%.
- `get_context` payload under 5 KB average.
- Median response time improved by 30%.
- No increase in error rates or missing data.

