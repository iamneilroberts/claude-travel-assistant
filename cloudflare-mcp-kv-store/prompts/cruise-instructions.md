# Cruise Trip Instructions

Use these instructions when planning cruise vacations. Reference this guide for cruise-specific terminology, data structure, and best practices.

## When to Use the Cruise Template

Use the `cruise` template for trips where:
- The primary component is a cruise ship sailing
- Client needs ship info, port details, and shore excursions displayed
- Cruise-specific pricing breakdown is relevant (cruise fare, gratuities, port fees)

Use `cruise-planners` (general Cruise Planners branded) for non-cruise trips.

## Cruise Data Schema

### cruiseInfo (Ship Details)

```json
{
  "cruiseInfo": {
    "cruiseLine": "Royal Caribbean",
    "shipName": "Wonder of the Seas",
    "sailingDate": "March 15, 2026",
    "nights": 7,
    "cabin": {
      "category": "Ocean View Balcony",
      "deck": 9,
      "stateroom": "9421",
      "bedding": "King"
    },
    "embarkation": {
      "port": "Port Canaveral, FL",
      "time": "11:00 AM"
    },
    "debarkation": {
      "port": "Port Canaveral, FL",
      "time": "7:00 AM"
    }
  }
}
```

### ports (Ports of Call)

```json
{
  "ports": [
    {
      "day": 1,
      "port": "Port Canaveral, FL",
      "arrival": null,
      "departure": "4:00 PM",
      "description": "Embarkation day"
    },
    {
      "day": 2,
      "port": "At Sea",
      "arrival": null,
      "departure": null,
      "description": "Enjoy the ship's amenities"
    },
    {
      "day": 3,
      "port": "Nassau, Bahamas",
      "arrival": "8:00 AM",
      "departure": "5:00 PM",
      "description": "Capital city with beaches and shopping",
      "excursions": [
        {
          "name": "Atlantis Beach Day",
          "time": "9:00 AM",
          "duration": "6 hours",
          "price": 189,
          "status": "booked",
          "notes": "Includes access to Aquaventure water park"
        },
        {
          "name": "Catamaran Snorkel Adventure",
          "time": "9:30 AM",
          "duration": "3.5 hours",
          "price": 79,
          "status": "recommended",
          "notes": "Great for families"
        }
      ]
    }
  ]
}
```

### dining (Specialty Restaurant Reservations)

```json
{
  "dining": [
    {
      "restaurant": "Giovanni's Table",
      "date": "Day 2",
      "time": "6:30 PM",
      "status": "confirmed",
      "notes": "Italian family-style dining"
    },
    {
      "restaurant": "Izumi Hibachi",
      "date": "Day 5",
      "time": "7:00 PM",
      "status": "pending",
      "notes": "Requires $50 per person supplement"
    }
  ]
}
```

### credits (Onboard Credits & Packages)

```json
{
  "credits": {
    "onboardCredit": 200,
    "beveragePackage": "Deluxe Beverage Package",
    "wifiPackage": "Surf + Stream",
    "diningPackage": "3-Night Specialty Dining",
    "notes": "OBC can be used for spa, specialty dining, and shore excursions"
  }
}
```

### insiderTips (Cruise-Specific Tips)

**IMPORTANT: Keep this section SMALL and HIGH-IMPACT.** The purpose is to demonstrate the travel agent's expertise and add value - NOT to provide a comprehensive cruise guide.

**Guidelines:**
- **Maximum 4-6 tips total** - Quality over quantity
- Each tip should be **specific to this ship, sailing, or destination** - not generic cruise advice
- Tips should make the client think "my travel agent really knows their stuff"
- Avoid obvious advice like "arrive early" or "bring sunscreen"
- Focus on: hidden gems, money-saving secrets, ship-specific quirks, or destination insider knowledge

**Good tip examples:**
- "The Carnival Valor's Deck 10 aft has a secret quiet area with loungers that most guests don't know about"
- "Book Guy's Burger Joint lunch for Day 3 - the ship's Cozumel port day means shorter lines"
- "Request the corner table at the steakhouse for sunset views of Progreso"

**Bad tip examples (too generic):**
- "Arrive early on embarkation day" (everyone knows this)
- "Bring motion sickness medicine" (not specific to this trip)
- "The buffet is included" (basic cruise knowledge)

```json
{
  "insiderTips": [
    {
      "title": "Hidden Quiet Spot",
      "tip": "Deck 10 aft (behind the Lido pool) has a secluded sun deck that's almost always empty - perfect for morning coffee."
    },
    {
      "title": "Best Progreso Strategy",
      "tip": "Skip the tourist trap beach clubs. Take a $15 taxi to Chicxulub beach instead - locals only, pristine sand, and fresh ceviche stands."
    },
    {
      "title": "Embarkation Dining Secret",
      "tip": "Head straight to the steakhouse at 11:30 AM - they serve a complimentary welcome lunch that most passengers don't know about."
    },
    {
      "title": "Cozumel Port Timing",
      "tip": "This sailing shares Cozumel with 3 other ships. Beat the crowds by tendering at 7:30 AM or waiting until 2 PM when day-trippers leave."
    }
  ]
}
```

**DO NOT create extensive category-based tip sections.** A few well-chosen insider tips are far more valuable than 50 generic suggestions that overwhelm the client.

### budget (Cruise-Specific Pricing)

```json
{
  "budget": {
    "cruise": 3500,
    "flights": 800,
    "hotels": 300,
    "excursions": 500,
    "gratuities": 200,
    "insurance": 250,
    "perPerson": 2775,
    "total": 5550
  }
}
```

## Cruise Terminology Reference

### Cabin Categories
| Code | Type |
|------|------|
| IS | Inside (no window) |
| OV | Ocean View (window) |
| BL | Balcony |
| SU | Suite |
| GTY | Guarantee (assigned at sailing) |

### Common Cruise Terms
- **GTY (Guarantee)**: Booked at category level; specific cabin assigned before sailing
- **Port fees**: Government fees included in cruise fare
- **Gratuities**: Daily service charges (~$15-20/person/day)
- **OBC**: Onboard Credit - prepaid spending money
- **Tender port**: Ship anchors offshore; passengers take small boats to shore
- **Muster drill**: Mandatory safety briefing before departure
- **Embarkation**: Boarding the ship
- **Debarkation**: Leaving the ship at end of cruise

### Major Cruise Lines
- **Royal Caribbean**: Wonder, Oasis, Harmony of the Seas
- **Carnival**: Celebration, Jubilee, Mardi Gras
- **Norwegian**: Prima, Escape, Bliss
- **Princess**: Sun, Discovery, Enchanted
- **Celebrity**: Edge, Apex, Beyond
- **Disney**: Wish, Fantasy, Magic
- **MSC**: Meraviglia, Seashore, World Europa

## Shore Excursion Guidance

### Researching Excursions

**Always research both options:**

1. **Cruise line excursions first** - Search for the cruise line's official shore excursion offerings and pricing for each port. These are found on the cruise line's website under "Shore Excursions" or "Things to Do."

2. **Viator alternatives second** - Search Viator for equivalent tours at each port. Compare pricing and inclusions.

**When presenting options:**
- If Viator offers a **substantially cheaper** option (30%+ savings), show both options to the client
- **Always nudge toward the cruise line excursion** with reasoning like:
  - "The ship guarantees they won't leave without you on their excursions"
  - "Includes seamless pier pickup - no stress about timing"
  - "If the tour runs late, the ship waits"
- Only strongly recommend Viator/independent when the savings are dramatic AND the port is low-risk (pier is walkable, ship is docked not tendered)

**Why this matters:** The travel agent earns commission on cruise line excursions but not on Viator bookings. The client also gets better protection with cruise line tours. It's a win-win to book through the ship when prices are comparable.

### When to Book Through Ship
- First-time cruisers
- Ports requiring tender (ship won't wait for independent tours)
- Time-sensitive excursions (ship departure risk)
- Complex logistics requiring coordination
- When cruise line price is within 20-30% of independent options

### When to Book Independently
- Experienced cruisers who accept the risk
- Ports with pier-side attractions (walking distance)
- Dramatic price difference (50%+ savings)
- Simple activities (beach day, walking tour)
- Popular easy ports: Cozumel, Nassau, St. Thomas

### Excursion Status Values
- `booked` - Confirmed and paid
- `pending` - Reserved but not confirmed
- `recommended` - Suggested but not booked
- `cancelled` - Was booked, now cancelled

## Cruise Pricing Tips

1. **Always include gratuities** - Most cruise lines charge $15-20/person/day
2. **Port fees and taxes** - Usually $100-150/person, often included in cruise fare
3. **Beverage packages** - $60-100/person/day, must be purchased for all adults in cabin
4. **WiFi packages** - $15-25/day, discounts for full-voyage packages
5. **Travel insurance** - Highly recommended for cruise travel; covers medical evacuations at sea

## Common Cruise Questions

**Q: What's included in the cruise fare?**
A: Accommodations, main dining room meals, buffet, room service, entertainment, pools, fitness center. NOT included: specialty dining, alcohol, spa, shore excursions, gratuities.

**Q: When should we arrive at the port?**
A: Aim for 11 AM-12 PM on embarkation day. Ship typically departs 4-5 PM.

**Q: Do we need a passport?**
A: Required for most cruises. Closed-loop cruises (depart/return same US port) allow birth certificate + photo ID for US citizens, but passport strongly recommended.

**Q: What about seasickness?**
A: Mid-ship, lower deck cabins have least motion. Bring Dramamine or Sea-Bands. Most large ships have stabilizers making motion minimal.

## Cruise Flight Planning

Cruise flights have unique requirements. Missing embarkation = missing the cruise entirely.

### The Golden Rule

**Always fly in the day before embarkation.** No exceptions for:
- First-time cruisers
- International flights
- Connections through weather-prone hubs
- Morning embarkation ports

Same-day arrival is only acceptable for:
- Driving distance clients
- Very experienced cruisers who accept the risk
- Direct flights arriving before 10 AM to nearby airport

### Pre-Cruise Hotel

Budget one hotel night before embarkation:
- Near the port OR near the airport with port transfer
- Many cruise lines offer pre-cruise packages
- Independent booking often cheaper

**Port city hotel guidance:**
| Port | Nearby Hotels | Airport |
|------|--------------|---------|
| Port Canaveral, FL | Cocoa Beach, Cape Canaveral | MCO (45 min) |
| Miami, FL | Downtown Miami, Brickell | MIA (20 min) |
| Fort Lauderdale, FL | Fort Lauderdale Beach | FLL (10 min) |
| Galveston, TX | Galveston Island, Houston | IAH/HOU (60-90 min) |
| Seattle, WA | Downtown Seattle | SEA (30 min) |
| San Juan, PR | Old San Juan, Condado | SJU (15 min) |

### Return Flight Timing

**Debarkation reality:**
- Ship arrives 6-7 AM
- Customs/immigration: 30-90 min
- Self-assist debark (carry own bags): Off by 8 AM
- Regular debark: Off by 9-10 AM
- Suite/loyalty debark: Off by 8:30 AM

**Safe return flight timing:**
- Domestic flights: 1 PM or later
- International flights: 2 PM or later
- If booking earlier: Client accepts risk of missing flight

**Never book:**
- Flights before 11 AM (too risky)
- Tight connections on debark day
- Last flight of the day (no backup if delayed)

### Cruise Line Air Programs

**Pros:**
- Cruise line responsible if flights delayed
- Sometimes includes transfers
- May offer deviation options

**Cons:**
- Often more expensive than booking direct
- Less control over times/airlines
- Routing may not be optimal

**Recommendation:** Book independently for better pricing/control, but consider cruise air for:
- Complex international itineraries
- Clients who want one-stop shopping
- Repositioning cruises with different start/end cities

### Port City Airports

| Cruise Region | Primary Airport(s) | Notes |
|--------------|-------------------|-------|
| Caribbean (East FL) | MIA, FLL, MCO | FLL closest to Port Everglades |
| Caribbean (West FL) | TPA | Close to Tampa port |
| Caribbean (TX) | IAH, HOU | Both work for Galveston |
| Alaska | SEA, ANC | Seattle for roundtrip, Anchorage for one-way |
| Mediterranean | FCO, BCN, VCE, ATH | Varies by itinerary |
| Northern Europe | CPH, AMS, STO | Copenhagen common for Baltic |

### Cruise Flight Schema Addition

When adding flights to cruise trips, include:
```json
{
  "flights": {
    "outbound": {
      "date": "2026-03-14",
      "route": "ORD → MCO",
      "arrive": "3:30 PM",
      "notes": "Day before embarkation"
    },
    "return": {
      "date": "2026-03-22",
      "route": "MCO → ORD",
      "depart": "2:15 PM",
      "notes": "Debark day - afternoon flight"
    }
  },
  "prePostHotels": {
    "preCruise": {
      "name": "Radisson Resort at the Port",
      "location": "Cape Canaveral",
      "date": "2026-03-14",
      "includesTransfer": true
    }
  }
}
```

### Pricing Cruise Flights by Tier

**Value:** Economy, arrive day before, depart afternoon
**Premium:** Premium economy on long legs, arrive day before, consider lounge pass
**Luxury:** Business class if reasonable, arrive day before (or two for international), possible post-cruise stay
