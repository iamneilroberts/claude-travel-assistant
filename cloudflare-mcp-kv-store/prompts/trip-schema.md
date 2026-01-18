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
