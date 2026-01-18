# Voygent Prompt Analysis

Analysis from the perspective of Claude using the MCP to plan trips.

---

## Executive Summary

| Prompt | Grade | Issues | Priority Fixes |
|--------|-------|--------|----------------|
| system-prompt | B+ | Schema/template mismatch, placeholder issues | Medium |
| cruise-instructions | A- | Excellent, minor schema alignment | Low |
| validate-trip | B | Missing price validation, URL checking | Medium |
| import-quote | B- | No examples, handling unclear | Medium |
| analyze-profitability | B | Needs real data integration | Low |

**Overall:** Good foundation but missing several prompts for common workflows.

---

## System Prompt Analysis

### Strengths
- Clear discovery flow with numbered priorities
- Proactive guidance section is excellent
- Good save method guidance (patch vs save)
- Numbered menus requirement is helpful

### Issues Found

#### 1. Schema/Template Mismatch (High Priority)
The documented schema doesn't match what templates actually expect:

```json
// Documented in prompt:
"tiers": {
  "value": { "name": "Essential", "estimatedTotal": 0 },
  "premium": { "name": "Enhanced", "estimatedTotal": 0 },
  "luxury": { "name": "Ultimate", "estimatedTotal": 0 }
}

// Templates may expect different structure - verify actual template requirements
```

**Fix:** Audit templates and update schema documentation to match.

#### 2. Welcome Block Placeholders Don't Work
The welcome block shows `{lastTrip}` but this is rendered as plain text, not interpolated:
```
Last activity: {lastTrip} - {lastAction}
```

**Fix:** Either remove placeholders or document that Claude should fill these from `get_context` response.

#### 3. Missing Modification Workflow
No guidance on:
- What to do when client wants changes
- How to handle rebooking
- Managing version history

#### 4. No YouTube/Media Integration Guidance
The system has `youtube_search` but the prompt doesn't mention when/how to use it.

### Suggested Additions to System Prompt

```markdown
## Adding Media

### YouTube Videos
Use `youtube_search` for:
- Destination preview videos (search: "destination 4K walk tour")
- Activity guides (search: "activity name tips")
- Hotel reviews (search: "hotel name review")

Add video IDs to itinerary days:
```json
{
  "day": 1,
  "activities": [...],
  "media": [{ "type": "youtube", "videoId": "abc123", "title": "..." }]
}
```

### Photos
1. Ask user if they have photos to add
2. Call `prepare_image_upload` with category and description
3. Give user the upload link
4. After confirmation, image is ready at the returned URL
```

---

## Cruise Instructions Analysis

### Strengths
- Comprehensive schema with all cruise-specific fields
- Excellent terminology reference
- Good shore excursion guidance (ship vs independent)
- Practical pricing tips

### Issues Found

#### 1. No Link to Publishing
Missing guidance on which template to use when publishing cruise trips.

**Fix:** Add section:
```markdown
## Publishing Cruise Trips

Use `cruise` template for cruise-centric trips:
```
publish_trip(tripId, template="cruise", ...)
```

The cruise template displays:
- Ship info and cabin details
- Port schedule with times
- Shore excursion options per port
- Dining reservations
- Onboard credits and packages
```

#### 2. Missing `cruiseInfo` Validation
No guidance on which fields are required vs optional.

---

## Validate Trip Analysis

### Strengths
- Good categorization (Critical/Warning/Suggestion)
- Covers logistics and timing well
- Includes trip strengths (nice touch)

### Issues Found

#### 1. No Price Reasonableness Check
Missing validation of whether prices are realistic:
- $50/night hotel in Paris → Flag as suspiciously low
- $10,000 for economy flights → Flag as suspiciously high

#### 2. No URL Validation
Says "Malformed URLs" but doesn't specify how to check them.

#### 3. No Media Validation
Should check:
- Hero image exists
- YouTube videos have valid IDs
- Photos linked in itinerary exist

### Suggested Addition

```markdown
### Price Reasonableness
- Budget hotels: $50-150/night (varies by destination)
- Mid-range hotels: $150-300/night
- Luxury hotels: $300-800/night
- Economy flights (domestic): $200-600
- Economy flights (international): $500-1500
- Business class (international): $3000-8000

Flag prices outside these ranges for verification.

### Media Checklist
- [ ] Hero image set
- [ ] At least 2-3 images total
- [ ] YouTube videos have valid IDs (11 characters)
- [ ] No broken image URLs
```

---

## Import Quote Analysis

### Strengths
- Good extraction checklist by quote type
- Proper booking array structure
- Includes discrepancy flagging

### Issues Found

#### 1. No Example Quote Formats
Claude doesn't know what actual supplier quotes look like. Add examples:

```markdown
### Example: Cruise Quote
```
BOOKING CONFIRMATION
Royal Caribbean - Wonder of the Seas
Confirmation #: ABC123456
Sailing: March 15-22, 2026
Guests: John Smith, Jane Smith
Cabin: 9421 - Ocean View Balcony, Deck 9
Cruise Fare: $2,450.00
Port Fees: $198.00
Gratuities: $224.00
TOTAL: $2,872.00
Deposit Paid: $500.00
Balance Due: $2,372.00 by January 15, 2026
```

### Example: Hotel Quote
```
Marriott Bonvoy Reservation
Confirmation: 12345678
Hotel & Suites Name
123 Main Street, City
Check-in: March 10, 2026
Check-out: March 12, 2026
Room: Deluxe King
Rate: $189.00/night + tax
Total: $423.36
```
```

#### 2. No Handling of Partial Information
What if quote is missing key fields? Add guidance:

```markdown
### Handling Incomplete Quotes
If quote is missing information:
1. Import what's available
2. Flag missing fields
3. Ask user to provide or look up:
   - Missing confirmation numbers
   - Unclear pricing breakdown
   - Ambiguous dates/times
```

---

## Analyze Profitability Analysis

### Strengths
- Good commission rate reference table
- Solid upsell framework
- Service fee recommendations

### Issues Found

#### 1. No Integration with Trip Data
Doesn't explain how to extract pricing from the trip JSON to calculate commissions.

#### 2. Missing Supplier-Specific Rates
Could add preferred supplier bonuses:
```markdown
### Preferred Supplier Bonuses
- Royal Caribbean: Base 10% + 2% override at 25 cabins/year
- Marriott: 10% on commissionable rates
- Cruise Planners preferred: Additional 2-5% on most products
```

---

## Missing Prompts - Suggested Additions

### 1. `research-destination` (High Priority)

```markdown
# Destination Research

When client is undecided or exploring options, research destinations systematically.

## Gather Preferences First
- Climate preference (tropical, temperate, dry)
- Activity focus (beach, culture, adventure, relaxation)
- Budget tier (budget, mid-range, luxury)
- Travel experience (first international trip vs seasoned traveler)
- Physical considerations (mobility, altitude, health)

## Research Structure

### For Each Destination Option
1. **Quick Facts**
   - Best time to visit
   - Visa requirements for US citizens
   - Flight time from home airport
   - Language/currency
   - Safety considerations

2. **Budget Estimate**
   - Flights (economy/business)
   - Hotels (by tier)
   - Daily expenses
   - Total per person

3. **Highlights**
   - Top 3 must-see attractions
   - Best neighborhoods/areas
   - Unique experiences

4. **Considerations**
   - Rainy season / weather patterns
   - Major holidays affecting travel
   - Current events / travel advisories

## Comparison Format
Present 2-3 options in a comparison table:
| Factor | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Best For | ... | ... | ... |
| Budget | ... | ... | ... |
| Flight Time | ... | ... | ... |
| Best Season | ... | ... | ... |

Let client pick, then start discovery for chosen destination.
```

### 2. `handle-changes` (High Priority)

```markdown
# Handling Trip Changes

When clients request modifications after proposal is created.

## Change Types

### Minor Changes (use patch_trip)
- Date shifts (same duration)
- Room type upgrades
- Activity additions
- Name corrections

### Major Changes (may need new trip)
- Destination change
- Significant date change (different season)
- Party size change
- Complete itinerary overhaul

## Change Workflow

1. **Acknowledge the request**
   - Confirm what they want to change
   - Note any constraints mentioned

2. **Check impacts**
   - Cancellation fees on existing bookings
   - Availability for new dates/options
   - Price differences

3. **Present options**
   - Option A: Modify as requested (cost/implications)
   - Option B: Alternative approach
   - Option C: Keep original (if change is problematic)

4. **Update trip**
   - Use patch_trip for changes
   - Update meta.status to reflect change
   - Note change history in meta.notes

5. **Re-validate**
   - Run validate_trip after major changes
   - Ensure logistics still work

## Common Change Scenarios

### Date Change
- Check flight availability
- Check hotel availability
- Note any price differences
- Watch for seasonal impacts

### Adding Travelers
- Check existing bookings can accommodate
- Get new traveler details
- Update pricing throughout
- May need different room configurations

### Cancellation
- Note all cancellation policies
- Calculate refund amounts
- Update trip status
- Archive but don't delete
```

### 3. `flight-search` (Medium Priority)

```markdown
# Flight Search Guidance

Structured approach to finding flights.

## Information Needed
- Origin airport(s) - consider alternates
- Destination airport(s) - consider alternates
- Dates (flexibility?)
- Number of passengers
- Class preference
- Airline preferences/loyalty programs
- Connection tolerance

## Search Strategy

### For Best Prices
1. Search flexible dates (+/- 3 days)
2. Compare nearby airports
3. Check one-way vs roundtrip
4. Look at positioning flights for cruises

### For Best Experience
1. Prioritize nonstop when available
2. Note layover lengths (1.5-3 hours ideal)
3. Consider arrival times (avoid red-eyes if possible)
4. Check seat availability for groups

## Present Results

| Option | Route | Times | Stops | Price | Notes |
|--------|-------|-------|-------|-------|-------|
| A | ORD→FCO | 5:30p-10:30a | Nonstop | $1,200 | Best option |
| B | ORD→FCO | 2:15p-9:45a | 1 (JFK) | $980 | Budget pick |
| C | ORD→FCO | 11:00a-7:30a | 1 (LHR) | $1,050 | Long layover |

Always include:
- Total travel time
- Carrier names
- Aircraft types for long hauls
- Baggage allowance notes
```

### 4. `group-trip` (Medium Priority)

```markdown
# Group Trip Management

For trips with 3+ travelers or multiple families/couples.

## Group Challenges
- Coordinating preferences
- Managing different budgets
- Booking multiple rooms
- Group activities vs free time
- Decision-making dynamics

## Information Gathering

### For Each Traveler/Family
- Names and ages
- Budget comfort level
- Must-haves and deal-breakers
- Physical considerations
- Dietary restrictions

### For the Group
- Who is the decision-maker/coordinator?
- How are costs being split?
- Group activities wanted?
- Free time needed?

## Accommodation Strategy
- Note which travelers share rooms
- Consider connecting rooms for families
- Look at vacation rentals for large groups
- Calculate per-person costs clearly

## Itinerary Balance
- Include group activities
- Build in optional activities
- Schedule free time
- Plan group meals vs individual dining

## Pricing Presentation
Show both:
- Total group cost
- Per-person breakdown
- Per-family/couple breakdown
```

### 5. `seasonal-guidance` (Low Priority)

```markdown
# Seasonal Travel Guidance

Quick reference for destination timing.

## When to Ask About Seasons
- Client has flexible dates
- Destination has distinct seasons
- Trip involves outdoor activities
- Budget is a primary concern

## Key Seasonal Factors
- Weather patterns
- Peak/shoulder/off-season pricing
- Local holidays and events
- Crowd levels
- Operating hours (some attractions seasonal)

## Regional Patterns

### Caribbean
- Peak: Dec-Apr (dry season)
- Hurricane: Jun-Nov
- Best value: May, early Dec

### Europe
- Peak: Jun-Aug
- Shoulder: Apr-May, Sep-Oct (often ideal)
- Winter: Nov-Mar (except skiing)

### Asia
- Varies greatly by region
- Monsoon seasons differ
- Chinese New Year affects availability

### South Pacific
- Peak: May-Oct (dry)
- Wet season: Nov-Apr
- Cyclone risk: Dec-Mar

## How to Use
1. Note client's dates
2. Check if optimal for destination
3. If not optimal, discuss:
   - What they'll experience
   - Whether dates are flexible
   - Alternative destinations for those dates
```

---

## Efficiency Improvements

### 1. Reduce Redundancy
The system prompt repeats "Never generate HTML" in multiple places. Consolidate.

### 2. Quick Reference Card
Add a condensed reference at the end of system prompt:

```markdown
## Quick Reference

| Task | Tool | Notes |
|------|------|-------|
| Start conversation | `get_context` | Always first |
| Small update | `patch_trip` | Dot notation |
| New/rebuild trip | `save_trip` | Full JSON |
| Add photo | `prepare_image_upload` | Give user link |
| Find videos | `youtube_search` | Add to media[] |
| Preview | `preview_publish` | Draft URL |
| Publish | `publish_trip` | Live URL |
| Check issues | `validate_trip` | Before publish |
| Client feedback | `get_comments` | Check regularly |
```

### 3. Error Handling Guidance
Add section for common errors:

```markdown
## Common Issues

**"System prompt not found"**
→ Admin needs to upload prompt to KV

**"Trip not found"**
→ Check trip ID spelling, use list_trips

**"Publish failed"**
→ Check GitHub token, try preview_publish first

**"Image upload failed"**
→ File too large (>10MB) or wrong format
```

---

## Priority Implementation Order

1. **High:** Add `research-destination` prompt (common workflow)
2. **High:** Add `handle-changes` prompt (frequent need)
3. **Medium:** Fix schema/template alignment in system prompt
4. **Medium:** Add `flight-search` prompt
5. **Medium:** Add example quotes to `import-quote`
6. **Low:** Add `group-trip` prompt
7. **Low:** Add `seasonal-guidance` prompt
8. **Low:** Add media integration guidance to system prompt

---

## Testing Checklist

To verify prompts work correctly:

- [ ] New trip from scratch (discovery → proposal → publish)
- [ ] Cruise trip using cruise template
- [ ] Validate trip catches real issues
- [ ] Import a sample booking quote
- [ ] Profitability analysis produces useful output
- [ ] Photo upload workflow works
- [ ] YouTube search adds videos to trip
- [ ] Client comments flow works
- [ ] Changes to existing trip handled smoothly
