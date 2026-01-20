# Handling Trip Changes

Guide for managing modifications after a proposal is created or bookings are made.

## Change Categories

### Minor Changes → Use `patch_trip`
- Date shifts within same week
- Room type upgrades (same hotel)
- Adding activities to existing days
- Name spelling corrections
- Contact info updates
- Adding notes or preferences

### Moderate Changes → May affect bookings
- Different hotel (same destination)
- Adding/removing travelers
- Extending or shortening trip
- Swapping activities
- Flight time preferences

### Major Changes → Potential rebooking required
- Destination change
- Significant date change (different month/season)
- Complete itinerary overhaul
- Cancellation

## Change Workflow

### Step 1: Acknowledge and Clarify

"I understand you'd like to [change]. Let me make sure I have this right:
- Current: [what's planned now]
- Requested: [what they want]
- Is that correct?"

### Step 2: Check Impacts

**For booked items, consider:**
- Cancellation policies and deadlines
- Change fees
- Availability for new dates/options
- Price differences (up or down)
- Domino effects on other bookings

**Read the trip first** to understand what's already booked:
```
read_trip(tripId)
```

Look for `bookings` array entries with `status: "confirmed"`.

**Check reference data** if the trip has confirmed bookings:
```
get_reference(tripId)
```

If reference data exists, changes to dates, ports, or traveler info must align with what's actually booked. You can't just change the itinerary if it conflicts with the confirmed booking—the booking is the source of truth.

### Step 3: Present Options

Always give choices when there are tradeoffs:

```
I looked into changing your dates. Here are your options:

1. **Change to new dates** - Hotel has availability, $50 more total
   - Need to rebook flights (no fee if 24+ hrs before)
   - Activities available, same prices

2. **Keep original dates** - No changes needed
   - You mentioned [reason for change] - is that a dealbreaker?

3. **Hybrid approach** - Shorten by 1 day
   - Avoids the conflict you mentioned
   - Saves $180 on hotel

Which works best for you?
```

### Step 4: Make the Updates

**For minor changes:**
```
patch_trip(tripId, {
  "travelers.names[1]": "Jane Smith-Jones",
  "meta.status": "Updated traveler name"
})
```

**For moderate changes:**
```
// Read current trip
const trip = read_trip(tripId)

// Modify the relevant sections
// Save with updated data
save_trip(tripId, updatedTrip)
```

**Always update `meta.status`** to reflect the change:
```
patch_trip(tripId, {
  "meta.status": "Changed dates from Mar 10-17 to Mar 15-22",
  "meta.lastModified": "2026-01-14"
})
```

**If the booking itself changed** (e.g., supplier confirmed new dates), update the reference data:
```
set_reference(tripId, {
  source: { type: "hotel_modification", provider: "Marriott", reference: "MOD-456" },
  dates: { checkIn: "2026-03-15", checkOut: "2026-03-22" }
})
```

Reference data is additive—new data merges with existing records.

### Step 5: Validate After Major Changes

Run validation to catch any new issues:
```
validate_trip(tripId)
```

Check for:
- Logistics still work (travel times, connections)
- No gaps in lodging
- Activities available on new dates
- Pricing still accurate

### Step 6: Communicate What Changed

Summarize for the client:

```
Done! Here's what I updated:

**Changed:**
- Dates: Now March 15-22 (was March 10-17)
- Hotel: Same property, confirmed for new dates
- Flights: Rebooked, same times, new dates

**No change needed:**
- Tours and activities (available on new dates)
- Pricing (same rates apply)

**Action needed:**
- I'll send you the updated proposal link
- Review and let me know if anything else needs adjusting
```

## Common Change Scenarios

### Date Change
1. Check all bookings for availability on new dates
2. Note any price differences
3. Check cancellation policies on current bookings
4. Watch for seasonal impacts (weather, crowds, pricing)
5. Update all date references in trip

### Adding Travelers
1. Get new traveler details (name, DOB if needed)
2. Check room configurations (may need different room type)
3. Update pricing throughout (per-person costs)
4. Check activity capacities
5. Add to `travelers` array

### Removing Travelers
1. Confirm who is being removed
2. Check booking policies (name changes vs cancellation)
3. Update room configuration if needed
4. Recalculate pricing
5. Note if any deposits are non-refundable

### Upgrading Components
1. Check availability of upgrade
2. Calculate price difference
3. Note what's included in upgrade
4. Update trip with new details
5. Highlight the enhancement in summary

### Cancellation
1. Review all cancellation policies
2. Calculate refundable amounts
3. Note any non-refundable deposits
4. Update trip status to "cancelled"
5. Keep trip record (don't delete) for reference
6. Offer to help with future travel

## Preserving History

When making significant changes, preserve context:

```json
{
  "meta": {
    "status": "Dates changed per client request",
    "changeHistory": [
      {
        "date": "2026-01-14",
        "change": "Moved dates from Mar 10-17 to Mar 15-22",
        "reason": "Client work conflict"
      }
    ]
  }
}
```

## Red Flags to Watch

- Changes within 24-48 hours of travel (may be too late)
- Changes to non-refundable bookings
- Peak season changes (limited availability)
- Group bookings (more complex to modify)
- Multiple changes to same component (reconsider the fit)

## When to Suggest Alternatives

If the requested change is problematic:

"That change would [issue]. Instead, could we:
- [Alternative A]
- [Alternative B]
- [Keep original with adjustment]"

Don't just say "no" - always offer a path forward.
