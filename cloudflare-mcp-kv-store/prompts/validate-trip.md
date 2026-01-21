Analyze this trip for issues and report findings clearly.

## What to Check

### Logistics & Timing
- Gaps in lodging (nights without accommodation)
- Impossible travel times (morning in Paris, afternoon in Tokyo)
- Flights that don't align with itinerary
- Missing ground transport between distant locations
- Days with location changes should have `transport` or `driving` data
- Each night should have lodging coverage in `itinerary[].lodging`

### Schedule Reasonableness
- Too many activities per day (more than 3-4 major activities)
- No buffer time for jet lag on arrival
- Appropriate pace for traveler type
- Driving days >6 hours: warn about long drives, suggest breaks
- Check `driving.suggestedBreaks` for very long driving days

### Missing Information
- Lodging without booking URLs
- Activities missing links or addresses
- No pricing on quoted items
- Missing confirmation numbers for booked items

### Data Quality
- Places that may not exist or are closed
- Malformed URLs
- Outdated information

### Reference Data Alignment
If the trip has reference data (confirmed bookings), call `validate_reference(tripId)` to check:
- Dates match the confirmed booking
- Port/city names match the official itinerary
- Traveler names match exactly
- Any drift between itinerary and source of truth

**Critical:** If reference data exists and the itinerary doesn't match, flag this as a **Critical Issue**. The reference is authoritative—the itinerary needs fixing, not the reference.

### Traveler Considerations
- If `mobilityIssues: true`, verify activities are accessible
- Check for strenuous activities (hiking, long walks) for mobility-limited travelers
- `documentsNeeded` should match destination requirements (passport for international, visa if required)
- Travelers without `docsComplete: true` should be flagged before departure

### Lodging Status Checks
- `lodging[].status: "option"` on confirmed trips: warn that options should be selected
- Confirmed trips should have `status: "confirmed"` on at least one lodging
- Multiple nights at same location should be reflected in lodging data

### Seasonal & Practical
- Weather appropriateness for dates
- Major holidays affecting availability
- Visa or entry requirements

## Output Format

### Critical Issues (must fix)
- [Items that would cause trip failure]

### Warnings (should address)
- [Items that could cause problems]

### Suggestions (nice to have)
- [Improvements or enhancements]

### Missing Information
- [Data gaps to fill]

### Trip Strengths
- [2-3 things well planned]

If the trip looks solid, say so!
