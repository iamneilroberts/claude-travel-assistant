Parse this booking quote/confirmation and update the trip data.

## Steps

### 1. Identify Quote Type
Detect from content: cruise, hotel, air, tour, package, or insurance

### 2. Extract Key Information

**Cruise:** Line, ship, dates, ports, cabin, guests, pricing breakdown, confirmation, deposit/payment dates

**Hotel:** Property, address, dates, room type, rate, confirmation, cancellation policy

**Air:** Airline, flights, times, airports, passengers, fare class, record locator, baggage

**Tour:** Operator, tour name, date/time, participants, meeting point, confirmation

**Insurance:** Provider, plan, coverage dates, travelers, policy number

### 3. Update Trip Data

Use `patch_trip` or `save_trip` to add:
- Confirmation numbers
- Actual pricing (replace estimates)
- Exact dates/times
- Supplier names as booked

Add to `bookings` array:
```json
{
  "type": "cruise",
  "supplier": "Royal Caribbean",
  "confirmation": "ABC123",
  "status": "confirmed",
  "totalPrice": 2450,
  "depositPaid": 500,
  "balanceDue": "2026-08-15"
}
```

### 4. Flag Discrepancies

Compare against existing plan:
- Date mismatches
- Name spelling differences
- Price changes from estimates
- Different room/cabin than planned

### 5. Set Reference Data (Source of Truth)

**For confirmed bookings**, call `set_reference` to establish the source of truth:

```
set_reference(tripId, {
  source: { type: "cruise_confirmation", provider: "Royal Caribbean", reference: "ABC123" },
  travelers: [{ name: "John Doe", dob: "1980-05-15" }],
  dates: { tripStart: "2026-03-15", tripEnd: "2026-03-22" },
  // Include ports, flights, hotels as confirmed
})
```

**Why this matters:** The reference is authoritative. Future trip modifications should be validated against this data. If dates in the itinerary drift from the reference, the itinerary needs fixing—not the reference.

### 6. Report Summary

Tell the user:
- What was imported
- What was updated
- Any discrepancies found
- Whether reference data was set (for confirmed bookings)
- Action items (e.g., "Final payment due Aug 15")

---

**Quote to Parse:**
```
{{quoteText}}
```
