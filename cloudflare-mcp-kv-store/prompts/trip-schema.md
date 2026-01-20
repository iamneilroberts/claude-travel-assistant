# Complete Trip Schema Reference

Use this reference when creating or significantly restructuring a trip. The schema below shows all available fields with example values.

```json
{
  "meta": {
    "tripId": "destination-client-date",
    "clientName": "Client Name - Trip Title",
    "destination": "Primary Destination",
    "dates": "Date range",
    "phase": "discovery|planning|proposal|confirmed",
    "status": "Brief status note",
    "lastModified": "2026-01-14"
  },
  "travelers": {
    "count": 2,
    "names": ["John Smith", "Jane Smith"],
    "details": [{ "name": "John Smith", "age": 45 }]
  },
  "dates": {
    "start": "2026-03-15",
    "end": "2026-03-22",
    "duration": 7,
    "flexible": false
  },
  "budget": {
    "lineItems": [
      { "label": "Flights", "amount": 1200, "notes": "Round-trip per person" },
      { "label": "Accommodations (6 nights)", "amount": 1500 },
      { "label": "Tours & Activities", "amount": 400 },
      { "label": "Transfers", "amount": 150 }
    ],
    "perPerson": 3000,
    "total": 6000,
    "notes": "Estimate based on current rates. Final pricing upon booking."
  },
  "flights": {
    "outbound": {
      "date": "2026-03-15",
      "route": "ORD → FCO",
      "airline": "United",
      "flightNo": "UA123",
      "depart": "5:30 PM",
      "arrive": "10:30 AM+1"
    },
    "return": {
      "date": "2026-03-22",
      "route": "FCO → ORD",
      "airline": "United",
      "flightNo": "UA456",
      "depart": "11:00 AM",
      "arrive": "3:30 PM"
    }
  },
  "lodging": [
    {
      "name": "Hotel Excelsior",
      "location": "Rome",
      "dates": "Mar 15-18",
      "nights": 3,
      "rate": 250,
      "total": 750,
      "url": "https://...",
      "map": "Rome, Italy",
      "confirmed": false
    }
  ],
  "itinerary": [
    {
      "day": 1,
      "date": "2026-03-15",
      "title": "Arrival in Rome",
      "location": "Rome",
      "activities": [
        {
          "time": "Evening",
          "name": "Check into hotel",
          "description": "Settle in and rest after flight"
        }
      ],
      "meals": ["Dinner at hotel"],
      "map": "Rome historic center",
      "media": []
    }
  ],
  "tiers": {
    "value": {
      "name": "Essential",
      "description": "Core experience, smart savings",
      "includes": ["Economy flights", "3-star hotels", "Shared transfers"],
      "perPerson": 2250,
      "estimatedTotal": 4500
    },
    "premium": {
      "name": "Enhanced",
      "description": "Added comfort and experiences",
      "includes": ["Premium economy flights", "4-star boutique hotels", "Private transfers", "2 guided tours"],
      "perPerson": 3000,
      "estimatedTotal": 6000
    },
    "luxury": {
      "name": "Ultimate",
      "description": "Top-tier everything",
      "includes": ["Business class flights", "5-star luxury hotels", "Private car & driver", "VIP experiences"],
      "perPerson": 4500,
      "estimatedTotal": 9000
    },
    "notes": "All tiers include travel insurance. Prices subject to availability at time of booking."
  },
  "media": [
    {
      "type": "image",
      "url": "https://...",
      "caption": "Colosseum at sunset",
      "category": "hero"
    }
  ],
  "bookings": [
    {
      "type": "hotel",
      "supplier": "Hotel Excelsior",
      "confirmation": "HX12345",
      "status": "confirmed",
      "amount": 750,
      "bookedDate": "2026-01-10"
    }
  ],
  "featuredLinks": [
    {
      "url": "https://www.romeguide.it/colosseum-tips",
      "title": "Colosseum Visitor Tips",
      "description": "Skip-the-line strategies and best photo spots"
    }
  ]
}
```

## Field Notes

### meta
- `tripId`: URL-safe identifier (lowercase, hyphens)
- `phase`: discovery → planning → proposal → confirmed
- `status`: Brief note about current state (shown in activity log)

### budget.lineItems
Each item needs:
- `label`: What the cost is for
- `amount`: Number (no currency symbol)
- `notes`: Optional explanation

### lodging[] (ARRAY - not object)
Each entry covers one hotel stay. Include `url` for booking links.

### itinerary[] (ARRAY - not object)
One entry per day. Activities array within each day.

### tiers
Three options for proposals:
- `value`: Budget-friendly
- `premium`: Mid-range upgrade
- `luxury`: Top tier

### media
- `type`: "image" or "youtube"
- `category`: "hero", "lodging", "activity", "destination"
- For YouTube: use `videoId` instead of `url`

### bookings
Track confirmed reservations with confirmation numbers.

---

## Cruise Trip Addendum

When building cruise trips, use these additional fields alongside the standard schema. See `cruise-instructions.md` for cruise planning best practices.

### cruiseInfo (Ship Details)

Top-level object for cruise-specific information:

```json
{
  "cruiseInfo": {
    "cruiseLine": "Royal Caribbean",
    "shipName": "Wonder of the Seas",
    "cabin": {
      "type": "Balcony Stateroom",
      "category": "Family-friendly with balcony",
      "deck": 9,
      "stateroom": "9421",
      "notes": "Accommodates 4 guests"
    },
    "embarkation": {
      "port": "Fort Lauderdale (Port Everglades)",
      "date": "2026-07-19",
      "time": "Check-in opens 11:00am, all aboard 4:00pm",
      "tips": "Priority boarding available with drink packages"
    },
    "debarkation": {
      "port": "Fort Lauderdale (Port Everglades)",
      "date": "2026-07-26",
      "time": "Ship docks ~7:00am, debarkation 8:00am-10:30am",
      "tips": "Self-assist debark is fastest"
    }
  }
}
```

### Cruise-Specific Lodging Fields

Add these fields to `lodging[]` entries for cruise trips:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"pre-cruise"`, `"cruise"`, or `"post-cruise"` |
| `checkIn` | string | ISO date (e.g., `"2026-07-18"`) |
| `checkOut` | string | ISO date (e.g., `"2026-07-19"`) |
| `options` | array | Alternative hotel options (see below) |

**Lodging options array** for pre/post cruise hotels:

```json
{
  "options": [
    {
      "name": "Hilton Fort Lauderdale Marina",
      "tier": "premium",
      "rate": 250,
      "pros": "Walk to port, pool, views",
      "cons": "Pricier"
    },
    {
      "name": "Hampton Inn Cruise Port",
      "tier": "value",
      "rate": 160,
      "pros": "Free shuttle, breakfast included",
      "cons": "Basic amenities"
    }
  ]
}
```

### Cruise-Specific Itinerary Fields

Add these fields to `itinerary[]` entries:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | `"pre-cruise"`, `"embarkation"`, `"sea-day"`, `"port-day"`, or `"debarkation"` |
| `portInfo` | object | Port arrival/departure details (port days only) |
| `seaDayTips` | object | Tips organized by audience (sea days only) |
| `crowdAvoidance` | array | Strategies for avoiding crowds |

**portInfo object** (for port days):

```json
{
  "portInfo": {
    "arrive": "8:00 AM",
    "depart": "5:00 PM",
    "allAboard": "4:30 PM",
    "dockOrTender": "dock",
    "walkable": true,
    "tenderNote": "Tender port - get in line early or late to avoid the crush"
  }
}
```

- `dockOrTender`: `"dock"`, `"tender"`, or `"tender usually"`
- `walkable`: `true`, `false`, or `"port area only"`

**seaDayTips object** (for sea days):

```json
{
  "seaDayTips": {
    "adults": ["Book spa treatments on sea days", "Adults-only areas during kids club hours"],
    "teen": ["Teen clubs come alive on sea days", "Most ships have teen-only pool parties"],
    "child": ["Kids clubs have the best programming", "Morning is best for pools"],
    "family": ["Family trivia competitions are fun!", "Order room service for lazy mornings"]
  }
}
```

### Activity Flags

Add these fields to activities within `itinerary[].activities[]`:

| Field | Type | Description |
|-------|------|-------------|
| `forWho` | array | Target audience (strict enum): `"all"`, `"adults"`, `"teen"`, `"child"` - use combinations like `["teen", "adults"]` |
| `familyFriendly` | boolean | Suitable for all ages |
| `highlight` | boolean | Standout activity - don't miss |
| `duration` | string | Time required (e.g., `"3-4 hours"`) |
| `bookingRequired` | boolean | Must book in advance |
| `crowdLevel` | string | `"low"`, `"moderate"`, `"busy"`, or descriptive |
| `avoidCrowdsTip` | boolean | Marks crowd-beating advice |
| `included` | boolean | Part of cruise package (shows green badge) |
| `optional` | boolean | Available if time permits (shows amber badge) |

**Example activity with cruise flags:**

```json
{
  "time": "Morning",
  "name": "Stingray City",
  "description": "World-famous sandbar where you can touch and feed wild stingrays",
  "cost": 200,
  "forWho": ["all"],
  "familyFriendly": true,
  "highlight": true,
  "duration": "3 hours",
  "bookingRequired": true,
  "crowdLevel": "busy but worth it",
  "notes": "Book early - sells out"
}
```

### cruiseSpecificTips (Top-Level)

General cruise advice organized by category:

```json
{
  "cruiseSpecificTips": {
    "seaDays": {
      "overview": "Sea days are when the ship's activities shine.",
      "byAge": {
        "adults": ["Spa & thermal suite", "Wine tasting", "Adults-only pool"],
        "teens": ["Teen club hangout", "Sports tournaments", "FlowRider"],
        "children": ["Kids club programs", "Splash pad", "Mini golf"]
      }
    },
    "portDays": {
      "overview": "Crowds follow the herd. Be first off OR last off, never middle.",
      "strategies": [
        "Early risers: First tender/walkoff, finish by noon",
        "Late starters: Skip morning rush, depart 10am",
        "Ship day: Stay aboard when others leave"
      ]
    },
    "dining": {
      "included": ["Main dining room", "Buffet", "Room service"],
      "specialty": ["Steakhouse", "Italian", "Sushi"],
      "familyTip": "Anytime dining works best for families"
    },
    "packing": {
      "mustHave": ["Passports", "Motion sickness meds", "Reef-safe sunscreen"],
      "skip": ["Beach towels (ship provides)", "Hair dryer (in cabin)"]
    }
  }
}
```

### Enhanced travelers.details

For cruise trips with mixed age groups, include traveler type:

```json
{
  "travelers": {
    "count": 4,
    "names": ["Adult 1", "Adult 2", "Teen (14)", "Child (9)"],
    "details": [
      { "name": "Adult 1", "type": "adult" },
      { "name": "Adult 2", "type": "adult" },
      { "name": "Teen", "type": "teen", "age": 14 },
      { "name": "Child", "type": "child", "age": 9 }
    ]
  }
}
```

Type values: `"adult"`, `"teen"`, `"child"`

### Field Notes for Cruise Trips

- **Use `type` fields** to distinguish itinerary day types and lodging phases
- **Port info in itinerary**, not separate `ports[]` array - keeps all daily info together (note: `ports[]` is deprecated; use `itinerary[].portInfo` instead)
- **Use `cruiseLine`/`shipName`** (not `line`/`ship`) to match template expectations
- **`forWho` enables filtering** - templates can show age-appropriate activities
- **`included` vs `optional`** - critical for cruise packages with pre-booked excursions
- **`highlight` activities** - templates can feature these prominently
- **Sea day tips** - helps families split up and maximize ship time
