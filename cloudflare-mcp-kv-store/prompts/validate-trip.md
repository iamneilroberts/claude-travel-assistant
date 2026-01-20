Analyze this trip for issues and report findings clearly.

## What to Check

### Logistics & Timing
- Gaps in lodging (nights without accommodation)
- Impossible travel times (morning in Paris, afternoon in Tokyo)
- Flights that don't align with itinerary
- Missing ground transport between distant locations

### Schedule Reasonableness
- Too many activities per day (more than 3-4 major activities)
- No buffer time for jet lag on arrival
- Appropriate pace for traveler type

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
