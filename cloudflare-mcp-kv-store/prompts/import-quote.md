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

### 5. Report Summary

Tell the user:
- What was imported
- What was updated
- Any discrepancies found
- Action items (e.g., "Final payment due Aug 15")

---

**Quote to Parse:**
```
{{quoteText}}
```
