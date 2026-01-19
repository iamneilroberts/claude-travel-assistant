# Session 1: Template Structure & Section Reorganization

## Goal

Restructure the cruise template to improve information flow: lead with budget/investment, consolidate related sections, create a unified day-by-day timeline, and remove redundant content.

## Scope

- Reorder major sections (budget first, then cruise details)
- Combine ports of call + day-by-day itinerary into unified timeline
- Merge booking details into budget section
- Move included value under pricing
- Remove embark/debark cards (info moves to unified timeline)
- Suppress Travel Style section by default

## Files to Modify

| File | Changes |
|------|---------|
| `src/templates/cruise.html` | Major section reordering and consolidation |
| `src/template-renderer.ts` | Add `_config` flags for section visibility |

## Current Section Order (cruise.html)

```
1. Your Cruise (line 1936)
2. About Your Ship (line 2123)
3. Ports of Call (line 2185)
4. Dining Reservations (line 2262)
5. Shore Excursion Options (line 2287)
6. Viator Tours (line 2337)
7. Onboard Credits & Packages (line 2373)
8. Insider Tips (line 2422)
9. Your Travel Party (line 2439/2459)
10. Booking Details (line 2493)
11. Onboard Credits (line 2544)
12. What's Included (line 2570)
13. Included Value (line 2599)
14. Enhance Your Experience (line 2665)
15. Packing Guide (line 2687)
16. Action Items (line 2709)
17. Your Travel Style (line 2725)
18. Flight Details (line 2751)
19. Flight Options Comparison (line 2828)
20. Pre/Post Cruise Accommodations (line 2922)
21. Day-by-Day Itinerary (line 2994)
22. Special Recommendations (line 3227)
23. Maps (line 3263)
24. Destination Map (line 3285)
25. Helpful Videos (line 3306)
26. Useful Resources (line 3333)
27. Package Options (line 3356)
28. Investment Summary (line 3432)
```

## Target Section Order

```
1. Investment Summary (moved from #28) - renamed "Your Investment"
   └── Includes: Budget breakdown, Booking Details (merged), Included Value (condensed)
2. Your Cruise (ship info, cabin, deck plan links)
   └── Remove embark/debark cards (info goes to timeline)
3. About Your Ship (optional, if shipInfo exists)
4. Your Travel Party
5. Flight Details / Flight Options
6. Pre/Post Cruise Accommodations
7. Unified Day-by-Day Timeline (NEW - combines #3, #21)
   └── Includes: Flight arrival, transfers, hotel check-in, embarkation, each port day, debarkation, return flight
   └── Each day shows: port info, included tours, optional tours, activities, dining
8. Shore Excursion Options
9. Viator Tours
10. Dining Reservations
11. Onboard Credits & Packages
12. Enhance Your Experience (recommended extras)
13. What's Included
14. Insider Tips
15. Packing Guide
16. Action Items
17. Maps (collapsed by default - Session 2)
18. Helpful Videos
19. Useful Resources
20. Package Options (if showing tiers)
21. Your Travel Style (hidden by default, show with _config.showTravelStyle)
```

## Plan

### Phase 1: Create Unified Investment Section

1. Create new section template block "Your Investment" combining:
   - Budget summary (total, per-person)
   - Line items from `budget.lineItems[]`
   - Booking details cards from `bookings[]`
   - Condensed "Included Value" (total value + key items, not full list)

2. Remove standalone sections:
   - "Booking Details" (line 2493)
   - "Investment Summary" (line 3432)
   - Condense "Included Value" (line 2599) - show total + top 5 items only

3. New markup structure:
```html
<div class="section" id="investment">
    <div class="section-header">
        <div class="section-icon">💰</div>
        <h2>Your Investment</h2>
    </div>

    <!-- Budget Summary Cards -->
    <div class="investment-summary-cards">
        <div class="investment-card total">
            <div class="label">Total Investment</div>
            <div class="value">{{formatCurrency budget.total}}</div>
        </div>
        <div class="investment-card per-person">
            <div class="label">Per Person</div>
            <div class="value">{{formatCurrency budget.perPerson}}</div>
        </div>
        {{#if includedValue.total}}
        <div class="investment-card value">
            <div class="label">Included Value</div>
            <div class="value">{{formatCurrency includedValue.total}}</div>
        </div>
        {{/if}}
    </div>

    <!-- Budget Line Items -->
    {{#if budget.lineItems}}
    <div class="budget-breakdown">
        <h4>Cost Breakdown</h4>
        <table class="budget-table">
            {{#each budget.lineItems}}
            <tr>
                <td class="item">{{label}}</td>
                <td class="amount">{{formatCurrency amount}}</td>
                {{#if notes}}<td class="notes">{{notes}}</td>{{/if}}
            </tr>
            {{/each}}
        </table>
    </div>
    {{/if}}

    <!-- Booking Details -->
    {{#if bookings}}
    <div class="bookings-summary">
        <h4>Booking Confirmations</h4>
        <div class="cards-grid">
            {{#each bookings}}
            <!-- existing booking card markup -->
            {{/each}}
        </div>
    </div>
    {{/if}}
</div>
```

### Phase 2: Create Unified Day-by-Day Timeline

1. Merge "Ports of Call" overview into day-by-day itinerary
2. Structure each day to include ALL relevant info:
   - Pre-cruise days: Flight arrival, hotel, transfers
   - Embarkation day: Check-in time, ship boarding, sail away
   - Port days: Port name, arrival/departure times, included tours, optional tours
   - Sea days: Onboard activities, dining highlights
   - Debarkation day: Disembark time, transfers, flight departure

3. Data sources to combine:
   - `cruiseInfo.ports[]` - port schedule
   - `itinerary[]` - day activities
   - `flights` - arrival/departure info
   - `lodging[]` - pre/post hotels
   - `cruiseInfo.embarkation/debarkation` - ship times

4. New unified timeline markup:
```html
<div class="section" id="timeline">
    <div class="section-header">
        <div class="section-icon">📅</div>
        <h2>Your Complete Itinerary</h2>
    </div>

    {{#each unifiedTimeline}}
    <div class="timeline-day {{dayType}}">
        <div class="day-header">
            <span class="day-number">Day {{dayNumber}}</span>
            <span class="day-date">{{formatDate date}}</span>
            <span class="day-title">{{title}}</span>
        </div>

        <div class="day-content">
            {{#if port}}
            <div class="port-info">
                <strong>{{port.name}}</strong>
                {{#if port.arrival}}<span class="port-time">Arrive: {{port.arrival}}</span>{{/if}}
                {{#if port.departure}}<span class="port-time">Depart: {{port.departure}}</span>{{/if}}
            </div>
            {{/if}}

            {{#if flight}}
            <div class="flight-info">
                <!-- Flight details for this day -->
            </div>
            {{/if}}

            {{#if hotel}}
            <div class="hotel-info">
                <!-- Hotel check-in/out for this day -->
            </div>
            {{/if}}

            {{#if activities}}
            <div class="day-activities">
                {{#each activities}}
                <div class="activity">
                    <span class="time">{{time}}</span>
                    <span class="name">{{name}}</span>
                    <span class="description">{{description}}</span>
                </div>
                {{/each}}
            </div>
            {{/if}}
        </div>
    </div>
    {{/each}}
</div>
```

### Phase 3: Remove Embark/Debark Cards

1. Delete embarkation/debarkation cards from "Your Cruise" section (lines 2095-2116)
2. Ensure embark/debark info is captured in unified timeline instead
3. Keep ship info, cabin details, deck plan links in "Your Cruise"

### Phase 4: Suppress Travel Style by Default

1. Wrap "Your Travel Style" section (line 2725) with conditional:
```html
{{#if _config.showTravelStyle}}
<div class="section">
    <!-- Travel Style content -->
</div>
{{/if}}
```

2. In `template-renderer.ts`, set `_config.showTravelStyle = false` by default
3. Allow override via trip data: `_config.showTravelStyle: true`

### Phase 5: Move Sections

1. Cut "Investment Summary" section and move to position after overview cards
2. Cut "Your Travel Style" section to end (with conditional wrapper)
3. Remove standalone "Booking Details" section
4. Remove standalone "Included Value" section (merged into investment)

## Data Shaping (template-renderer.ts)

Add preprocessing to create `unifiedTimeline[]` array:

```typescript
function buildUnifiedTimeline(tripData: any): any[] {
  const timeline: any[] = [];

  // Pre-cruise: flights, hotels before cruise
  // ...

  // Cruise days: merge ports + itinerary
  // ...

  // Post-cruise: debark, hotels, return flight
  // ...

  return timeline;
}
```

## Verification Checklist

- [ ] Investment section appears first after overview cards
- [ ] Investment section shows: total, per-person, line items, bookings, condensed included value
- [ ] Embark/debark cards removed from "Your Cruise" section
- [ ] Unified timeline shows complete trip from arrival to departure
- [ ] Each timeline day includes relevant port/flight/hotel/activity info
- [ ] Travel Style section hidden by default
- [ ] No duplicate information across sections
- [ ] Existing tours/excursions sections still work
- [ ] Page renders without errors

## Preview Command

```bash
curl -s -X POST "https://voygent.somotravel.workers.dev/sse?key=Kim.d63b7658" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"preview_publish","arguments":{"tripId":"greek-cruise-may-2026"}}}'
```

## Rollback Plan

Keep backup of current `cruise.html` before starting. Can revert via:
```bash
git checkout HEAD -- src/templates/cruise.html
```

## Data Shaping vs Data Cleanup (Session 4)

The `buildTemplateData` function in `template-renderer.ts` transforms trip data for display. We distinguish between two types of operations:

### Legitimate Display Transforms (KEEP in template-renderer)

These transform valid data into display-ready formats:
- **Type labels**: Convert `booking.type: "cruise"` → `typeLabel: "Cruise"`, `typeIcon: "🚢"`
- **Priority badges**: Map `extra.priority: "high"` → `badgeLabel: "Popular"`
- **viatorToursByPort**: Restructure viatorTours object into array for template iteration

### Data Cleanup Workarounds (MOVED to validate-on-save)

These fix bad data that shouldn't exist:
- **Emoji-only filtering**: Activities named just "🏛️" are invalid → now stripped on save
- **JSON sanitization**: `booking.details: "[{...}]"` is bad data → now cleared on save
- **Cabin image normalization**: `images.cabin` is non-canonical → auto-moved to `cruiseInfo.cabin.images`

### System Prompt Guidance

Rather than silently fixing bad data in the renderer, we:
1. Document canonical data locations in `system-prompt.md`
2. Enforce rules via `validateAndCleanTripData()` in `trips.ts`
3. Return warnings when data is auto-corrected

This makes it clear to Claude when data is being fixed, encouraging correct data generation upstream.
