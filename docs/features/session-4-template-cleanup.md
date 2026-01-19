# Session 4: Template System Cleanup

## Context

We analyzed the template system and reconciled with existing session plans (docs/features/session-1-template-structure.md, session-2-template-features.md, session-3-branding-prompt.md). Key decisions made:

## Decisions

1. **Remove code fallback**: Delete `src/default-template.ts` and update `src/template-renderer.ts` to remove the import and fallback logic (lines 7, 71-74). Templates will only come from KV.

2. **Keep templates separate**: cruise.html and default.html remain separate files (not consolidated) - they serve different product types.

3. **Distinguish data shaping vs data cleanup** in `buildTemplateData`:
   - **KEEP** (legitimate display transforms): type labels, priority badges, viatorToursByPort
   - **MOVE UPSTREAM** (workarounds for bad data):
     - Emoji-only filtering (lines 236-265) → validate-on-save + system prompt
     - JSON in booking.details/notes (lines 160-176) → validate-on-save + system prompt
     - Cabin image duplication (images.cabin) → validate-on-save + system prompt
     - Duplicate flight self-booking info (lines 306-327) → system prompt guidance

4. **Standardize canonical data locations**:
   - Cabin images: `cruiseInfo.cabin.images` only (remove `images.cabin` duplication logic)
   - Flight booking notes: `flightOptions.disclaimer` only

5. **Add lightweight validate-on-save** in save_trip/patch_trip handlers to prevent bad data patterns.

## Tasks

1. Delete `src/default-template.ts`
2. Update `src/template-renderer.ts`:
   - Remove DEFAULT_TEMPLATE import and fallback
   - Remove emoji filtering, JSON sanitization, cabin merge, flight dedup workarounds
   - Keep: type labels, priority badges, viatorToursByPort, insurance auto-recommend prep
3. Add validate-on-save in `src/mcp/tools/trips.ts` (or wherever save_trip lives):
   - Strip emoji-only itinerary content
   - Warn/clean JSON strings in booking.details/notes
   - Normalize cabin images to canonical location
4. Update `prompts/system-prompt.md`:
   - No placeholder emojis in itinerary
   - No raw JSON in display fields
   - Use `cruiseInfo.cabin.images` for cabin photos
   - Use `flightOptions.disclaimer` for booking notes
5. Update `docs/features/session-1-template-structure.md` to document this cleanup separation

## Files to Modify

| File | Action |
|------|--------|
| `src/default-template.ts` | DELETE |
| `src/template-renderer.ts` | Remove fallback + cleanup workarounds |
| `src/mcp/tools/trips.ts` | Add validate-on-save |
| `prompts/system-prompt.md` | Data quality guidance |
| `docs/features/session-1-template-structure.md` | Add cleanup section |

## Verification Checklist

- [ ] `default-template.ts` deleted
- [ ] `template-renderer.ts` no longer imports DEFAULT_TEMPLATE
- [ ] Template loading throws error if KV template missing (no silent fallback)
- [ ] Emoji filtering removed from buildTemplateData
- [ ] JSON sanitization removed from buildTemplateData
- [ ] Cabin image merging removed from buildTemplateData
- [ ] Flight dedup removed from buildTemplateData
- [ ] validate-on-save strips emoji-only content
- [ ] validate-on-save warns on JSON in display fields
- [ ] System prompt updated with data quality rules
- [ ] Existing trips still render correctly

## Preview Command

```bash
curl -s -X POST "https://voygent.somotravel.workers.dev/sse?key=Kim.d63b7658" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"preview_publish","arguments":{"tripId":"greek-cruise-may-2026"}}}'
```

## Rollback Plan

```bash
git checkout HEAD -- src/default-template.ts src/template-renderer.ts
```
