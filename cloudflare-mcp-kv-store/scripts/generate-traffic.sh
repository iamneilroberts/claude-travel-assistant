#!/bin/bash
# Generate realistic traffic for admin dashboard testing

BASE_URL="https://voygent.somotravel.workers.dev"

# Test users
USER1="TestAgent1.38cf62a2"
USER2="TestAgent2.96baae1c"
USER3="TestAgent3.d3962ebe"

# Helper function to make MCP calls
mcp_call() {
    local user=$1
    local method=$2
    local params=$3

    curl -s -X POST "${BASE_URL}?key=${user}" \
        -H "Content-Type: application/json" \
        -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"${method}\",\"arguments\":${params}}}"
    echo ""
}

echo "=== Generating Traffic for Admin Dashboard ==="
echo ""

# User 1: Active travel agent planning a Hawaii trip
echo ">>> TestAgent1: Planning Hawaii vacation..."
mcp_call "$USER1" "get_context" '{}'
sleep 0.5

mcp_call "$USER1" "save_trip" '{
    "key": "hawaii-family-2026",
    "data": {
        "meta": {
            "title": "Hawaii Family Adventure",
            "destination": "Maui, Hawaii",
            "status": "proposal"
        },
        "dates": {"start": "2026-03-15", "end": "2026-03-22"},
        "travelers": [{"name": "Johnson Family", "count": 4}],
        "budget": {"total": 8500},
        "lodging": [
            {"name": "Grand Wailea Resort", "location": "Wailea Beach", "pricePerNight": 450}
        ],
        "itinerary": [
            {"day": 1, "title": "Arrival & Beach Day", "activities": [{"name": "Airport pickup"}, {"name": "Check-in"}, {"name": "Sunset dinner"}]},
            {"day": 2, "title": "Road to Hana", "activities": [{"name": "Scenic drive"}, {"name": "Waterfalls"}, {"name": "Black sand beach"}]}
        ]
    }
}'
sleep 0.3

mcp_call "$USER1" "list_trips" '{}'
sleep 0.3

mcp_call "$USER1" "read_trip" '{"key": "hawaii-family-2026"}'
sleep 0.3

# User 1: Updates the trip
echo ">>> TestAgent1: Updating Hawaii trip..."
mcp_call "$USER1" "patch_trip" '{
    "key": "hawaii-family-2026",
    "updates": {
        "budget.total": 9200,
        "meta.status": "confirmed"
    }
}'
sleep 0.5

# User 2: Working on European tour
echo ""
echo ">>> TestAgent2: Creating European tour..."
mcp_call "$USER2" "get_context" '{}'
sleep 0.3

mcp_call "$USER2" "save_trip" '{
    "key": "europe-honeymoon-2026",
    "data": {
        "meta": {
            "title": "European Honeymoon",
            "destination": "Paris, Rome, Barcelona",
            "status": "proposal"
        },
        "dates": {"start": "2026-06-01", "end": "2026-06-14"},
        "travelers": [{"name": "Smith Couple", "count": 2}],
        "budget": {"total": 12000},
        "lodging": [
            {"name": "Hotel Plaza Athenee", "location": "Paris", "pricePerNight": 650},
            {"name": "Hotel de Russie", "location": "Rome", "pricePerNight": 550}
        ],
        "itinerary": [
            {"day": 1, "title": "Paris Arrival", "activities": [{"name": "Eiffel Tower"}, {"name": "Seine River cruise"}]},
            {"day": 5, "title": "Rome Discovery", "activities": [{"name": "Colosseum"}, {"name": "Vatican tour"}]}
        ]
    }
}'
sleep 0.3

mcp_call "$USER2" "list_templates" '{}'
sleep 0.3

# User 2: Lists trips multiple times (browsing behavior)
mcp_call "$USER2" "list_trips" '{}'
sleep 0.2
mcp_call "$USER2" "list_trips" '{}'
sleep 0.3

# User 3: Budget trip planner
echo ""
echo ">>> TestAgent3: Creating budget trips..."
mcp_call "$USER3" "get_context" '{}'
sleep 0.3

mcp_call "$USER3" "save_trip" '{
    "key": "vegas-weekend-2026",
    "data": {
        "meta": {
            "title": "Vegas Weekend Getaway",
            "destination": "Las Vegas, NV",
            "status": "confirmed"
        },
        "dates": {"start": "2026-02-14", "end": "2026-02-17"},
        "travelers": [{"name": "Wilson Couple", "count": 2}],
        "budget": {"total": 1500},
        "lodging": [
            {"name": "The Venetian", "location": "Las Vegas Strip", "pricePerNight": 180}
        ],
        "itinerary": [
            {"day": 1, "title": "Arrival & Shows", "activities": [{"name": "Check-in"}, {"name": "Cirque du Soleil"}]},
            {"day": 2, "title": "Grand Canyon Day Trip", "activities": [{"name": "Helicopter tour"}, {"name": "Sunset dinner"}]}
        ]
    }
}'
sleep 0.3

mcp_call "$USER3" "save_trip" '{
    "key": "cancun-spring-2026",
    "data": {
        "meta": {
            "title": "Cancun Spring Break",
            "destination": "Cancun, Mexico",
            "status": "deposit_paid"
        },
        "dates": {"start": "2026-04-05", "end": "2026-04-12"},
        "travelers": [{"name": "Garcia Group", "count": 6}],
        "budget": {"total": 4500},
        "lodging": [
            {"name": "Excellence Playa Mujeres", "location": "Playa Mujeres", "pricePerNight": 320}
        ],
        "itinerary": [
            {"day": 1, "title": "Beach Day", "activities": [{"name": "Resort arrival"}, {"name": "Pool party"}]},
            {"day": 3, "title": "Chichen Itza", "activities": [{"name": "Ancient ruins tour"}, {"name": "Cenote swimming"}]}
        ]
    }
}'
sleep 0.3

# More browsing activity
echo ""
echo ">>> Generating browsing activity..."
mcp_call "$USER1" "list_trips" '{}'
sleep 0.2
mcp_call "$USER2" "read_trip" '{"key": "europe-honeymoon-2026"}'
sleep 0.2
mcp_call "$USER3" "list_trips" '{}'
sleep 0.2

# Patch some trips
echo ""
echo ">>> Updating trip statuses..."
mcp_call "$USER3" "patch_trip" '{
    "key": "vegas-weekend-2026",
    "updates": {"meta.status": "paid_in_full"}
}'
sleep 0.3

mcp_call "$USER2" "patch_trip" '{
    "key": "europe-honeymoon-2026",
    "updates": {"meta.status": "deposit_paid", "budget.total": 13500}
}'
sleep 0.3

# User 1 creates another trip
echo ""
echo ">>> TestAgent1: Creating Alaska cruise..."
mcp_call "$USER1" "save_trip" '{
    "key": "alaska-cruise-2026",
    "data": {
        "meta": {
            "title": "Alaska Inside Passage Cruise",
            "destination": "Alaska Inside Passage",
            "status": "proposal"
        },
        "dates": {"start": "2026-07-10", "end": "2026-07-17"},
        "travelers": [{"name": "Miller Family", "count": 2}],
        "budget": {"total": 6800},
        "lodging": [
            {"name": "Celebrity Solstice", "location": "Cruise Ship", "pricePerNight": 420}
        ],
        "itinerary": [
            {"day": 1, "title": "Seattle Departure", "activities": [{"name": "Board ship"}, {"name": "Safety drill"}, {"name": "Sail away party"}]},
            {"day": 3, "title": "Juneau", "activities": [{"name": "Mendenhall Glacier"}, {"name": "Whale watching"}]}
        ]
    }
}'
sleep 0.3

# Validate a trip
echo ""
echo ">>> Validating trips..."
mcp_call "$USER1" "validate_trip" '{"tripId": "hawaii-family-2026"}'
sleep 0.3

# YouTube search for destination videos
echo ""
echo ">>> Searching YouTube for travel content..."
mcp_call "$USER2" "youtube_search" '{"query": "Paris travel guide 2026", "maxResults": 3}'
sleep 0.3

# Final browsing burst
echo ""
echo ">>> Final activity burst..."
mcp_call "$USER1" "list_trips" '{}'
mcp_call "$USER2" "list_trips" '{}'
mcp_call "$USER3" "list_trips" '{}'
sleep 0.2
mcp_call "$USER1" "read_trip" '{"key": "alaska-cruise-2026"}'
mcp_call "$USER2" "read_trip" '{"key": "europe-honeymoon-2026"}'
mcp_call "$USER3" "read_trip" '{"key": "cancun-spring-2026"}'

# Support request
echo ""
echo ">>> Submitting support request..."
mcp_call "$USER3" "submit_support" '{"subject": "Need help with booking confirmation", "message": "Client wants to confirm the Cancun trip but the payment link is not working.", "priority": "medium", "tripId": "cancun-spring-2026"}'

echo ""
echo "=== Traffic Generation Complete ==="
echo "Created trips:"
echo "  - hawaii-family-2026 (TestAgent1)"
echo "  - alaska-cruise-2026 (TestAgent1)"
echo "  - europe-honeymoon-2026 (TestAgent2)"
echo "  - vegas-weekend-2026 (TestAgent3)"
echo "  - cancun-spring-2026 (TestAgent3)"
echo ""
echo "View dashboard at: https://voygent.somotravel.workers.dev/admin/dashboard"
