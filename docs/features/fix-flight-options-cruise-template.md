# Fix Flight Options Comparison in Cruise Template

## Goal

Render the Flight Options Comparison section for the Greek cruise trip, showing all options, segments, pricing, and recommendation styling.

## Current Signal

- Rendered page at `https://somotravel.us/drafts/greek-cruise-may-2026.html` does not include the Flight Options Comparison section at all.
- Template source with the section exists in `cloudflare-mcp-kv-store/src/templates/cruise.html`.
- Template engine is a custom Handlebars-like renderer in `cloudflare-mcp-kv-store/src/simple-template.ts`.

## Likely Failure Points

1. Trip data does not include `flightOptions` (or uses a different path) in the published KV record.
2. The deployed KV template (`_templates/cruise` or `{keyPrefix}_templates/cruise`) is missing the section even if the repo file has it.
3. Template scoping for nested paths inside `#each` blocks is failing (ex: `outbound.segments` or `return.segments`).
4. Recommended option styling is not applied because the data lacks a `recommended` flag (or uses a different property).

---

## Plan

### 1) Verify data shape in KV

- Pull the trip JSON from KV: key `kim_d63b7658/greek-cruise-may-2026`.
- Confirm `flightOptions` exists at top-level and matches the expected structure:
  - `flightOptions.outboundDate`, `flightOptions.returnDate`
  - `flightOptions.options[]` (array)
  - `options[].outbound.segments[]`
  - `options[].return.segments[]`
- Check if the recommended option is represented as:
  - `options[].recommended` (boolean), or
  - a top-level key such as `flightOptions.recommendedLabel` / `flightOptions.recommendedIndex`.

### 2) Confirm which template is being rendered

- Fetch the template used by the trip:
  - First check `kim_d63b7658_templates/cruise` in KV.
  - If not present, check `_templates/cruise`.
- Compare the KV template with `cloudflare-mcp-kv-store/src/templates/cruise.html`.
- If the KV template is missing the Flight Options section, re-upload the updated template.

### 3) Make template changes for engine compatibility

If the KV template already includes the section but it still does not render:

- Replace nested path usage inside `#each` with `#with` blocks to avoid any scoping edge cases:
  - `{{#with outbound}}{{#each segments}}...{{/each}}{{/with}}`
  - `{{#with return}}{{#each segments}}...{{/each}}{{/with}}`
- Consider lowering the guard to `{{#if flightOptions}}` with a fallback empty state if `options` is not an array.
- If `recommended` uses a different property name, add a derived check in data or a fallback class condition in template.

### 4) Add short-lived debug output (if needed)

- Temporarily include `{{flightOptions}}` above the section to see if the data is reaching the template.
- Remove debug output after confirmation.

### 5) Republish and verify

- Run preview publish for the trip.
- Verify:
  - Section appears with 3 options.
  - Each option shows label, pricing, outbound and return segments.
  - Recommended option has green header.
  - Recommendation text appears at the bottom.

---

## Verification

- Load `https://somotravel.us/drafts/greek-cruise-may-2026.html`.
- Confirm all acceptance criteria above.
