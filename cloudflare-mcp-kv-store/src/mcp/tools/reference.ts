/**
 * Trip Reference Tools - Source of Truth Management
 *
 * These tools manage confirmed/authoritative trip data from official sources
 * (cruise line confirmations, hotel bookings, flight tickets, etc.)
 *
 * The reference is stored at: {keyPrefix}/{tripId}/_reference
 */

import type {
  Env,
  UserProfile,
  TripReference,
  ReferenceSource,
  ValidationResult,
  ValidationDrift
} from '../../types';

/**
 * Tool definitions for MCP
 */
export const referenceToolDefinitions = [
  {
    name: 'set_reference',
    description: `Set or update the confirmed reference data for a trip. This stores authoritative/confirmed data from official sources like cruise line confirmations, hotel bookings, or flight tickets. The reference serves as the "source of truth" that the trip itinerary should align with.

IMPORTANT: Only use this tool when you have CONFIRMED data from an official source (confirmation email, booking document, etc.). Do not use for tentative or proposed data.

The reference data is additive - new sources and data are merged with existing reference data. To completely replace the reference, use replace: true.`,
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'Trip ID to set reference for'
        },
        source: {
          type: 'object',
          description: 'Information about where this confirmed data came from',
          properties: {
            type: {
              type: 'string',
              enum: ['cruise_confirmation', 'hotel_confirmation', 'flight_confirmation', 'manual_entry', 'other'],
              description: 'Type of confirmation source'
            },
            provider: {
              type: 'string',
              description: 'Provider name (e.g., "Celestyal Cruises", "Marriott", "Delta")'
            },
            reference: {
              type: 'string',
              description: 'Confirmation/booking number'
            },
            notes: {
              type: 'string',
              description: 'Any notes about this source'
            }
          },
          required: ['type', 'provider']
        },
        travelers: {
          type: 'array',
          description: 'Confirmed traveler information',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              dob: { type: 'string', description: 'Date of birth (YYYY-MM-DD)' },
              passportExpiry: { type: 'string' },
              loyaltyNumbers: { type: 'object' }
            },
            required: ['name']
          }
        },
        dates: {
          type: 'object',
          description: 'Confirmed trip dates',
          properties: {
            tripStart: { type: 'string', description: 'YYYY-MM-DD' },
            tripEnd: { type: 'string', description: 'YYYY-MM-DD' },
            cruiseStart: { type: 'string', description: 'YYYY-MM-DD' },
            cruiseEnd: { type: 'string', description: 'YYYY-MM-DD' }
          }
        },
        cruise: {
          type: 'object',
          description: 'Confirmed cruise details',
          properties: {
            line: { type: 'string' },
            ship: { type: 'string' },
            cabin: { type: 'string' },
            bookingNumber: { type: 'string' },
            embarkation: {
              type: 'object',
              properties: {
                port: { type: 'string' },
                date: { type: 'string' },
                time: { type: 'string' }
              },
              required: ['port', 'date']
            },
            debarkation: {
              type: 'object',
              properties: {
                port: { type: 'string' },
                date: { type: 'string' },
                time: { type: 'string' }
              },
              required: ['port', 'date']
            },
            ports: {
              type: 'array',
              description: 'Port schedule from cruise line',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', description: 'YYYY-MM-DD' },
                  port: { type: 'string' },
                  country: { type: 'string' },
                  arrive: { type: 'string', description: 'HH:MM (24hr)' },
                  depart: { type: 'string', description: 'HH:MM (24hr)' },
                  isOvernight: { type: 'boolean' },
                  notes: { type: 'string' }
                },
                required: ['date', 'port']
              }
            }
          }
        },
        lodging: {
          type: 'array',
          description: 'Confirmed hotel/lodging bookings',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['pre-cruise', 'post-cruise', 'mid-trip', 'hotel'] },
              name: { type: 'string' },
              location: { type: 'string' },
              checkIn: { type: 'string' },
              checkOut: { type: 'string' },
              confirmation: { type: 'string' },
              roomType: { type: 'string' }
            },
            required: ['name', 'checkIn', 'checkOut']
          }
        },
        flights: {
          type: 'array',
          description: 'Confirmed flight bookings',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['outbound', 'return', 'connection'] },
              date: { type: 'string' },
              airline: { type: 'string' },
              flightNumber: { type: 'string' },
              from: { type: 'string' },
              to: { type: 'string' },
              departureTime: { type: 'string' },
              arrivalTime: { type: 'string' },
              confirmation: { type: 'string' }
            },
            required: ['date', 'from', 'to']
          }
        },
        replace: {
          type: 'boolean',
          description: 'If true, completely replace existing reference instead of merging. Default: false'
        }
      },
      required: ['tripId', 'source']
    }
  },
  {
    name: 'get_reference',
    description: 'Get the confirmed reference data (source of truth) for a trip. Returns the authoritative data from official confirmations that the trip itinerary should align with.',
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'Trip ID to get reference for'
        }
      },
      required: ['tripId']
    }
  },
  {
    name: 'validate_reference',
    description: `Validate a trip's itinerary against its confirmed reference data (source of truth). Checks for drift between the trip data and the confirmed bookings.

Returns a detailed report of any mismatches in:
- Dates (trip start/end, cruise dates)
- Port schedule (dates, arrival/departure times)
- Lodging (check-in/out dates)
- Flights (dates, times)

Use this BEFORE publishing to ensure the trip aligns with confirmed bookings.`,
    inputSchema: {
      type: 'object',
      properties: {
        tripId: {
          type: 'string',
          description: 'Trip ID to validate'
        }
      },
      required: ['tripId']
    }
  }
];

/**
 * Set or update trip reference data
 */
export async function setReference(
  args: Record<string, any>,
  env: Env,
  keyPrefix: string,
  _userProfile: UserProfile | null
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { tripId, source, travelers, dates, cruise, lodging, flights, replace } = args;

  if (!tripId) {
    return { content: [{ type: 'text', text: 'Error: tripId is required' }] };
  }

  if (!source || !source.type || !source.provider) {
    return { content: [{ type: 'text', text: 'Error: source with type and provider is required' }] };
  }

  const referenceKey = `${keyPrefix}${tripId}/_reference`;

  // Get existing reference if merging
  let existingRef: TripReference | null = null;
  if (!replace) {
    try {
      existingRef = await env.TRIPS.get(referenceKey, 'json');
    } catch {
      existingRef = null;
    }
  }

  // Build the new source entry
  const newSource: ReferenceSource = {
    type: source.type,
    provider: source.provider,
    date: new Date().toISOString().split('T')[0],
    reference: source.reference,
    notes: source.notes
  };

  // Build the reference object
  const reference: TripReference = {
    version: existingRef ? existingRef.version + 1 : 1,
    lastUpdated: new Date().toISOString(),
    sources: existingRef ? [...existingRef.sources, newSource] : [newSource],
    travelers: travelers || existingRef?.travelers,
    dates: dates ? { ...existingRef?.dates, ...dates } : existingRef?.dates,
    cruise: cruise ? mergeCruiseRef(existingRef?.cruise, cruise) : existingRef?.cruise,
    lodging: lodging ? mergeLodgingRef(existingRef?.lodging, lodging) : existingRef?.lodging,
    flights: flights ? mergeFlightsRef(existingRef?.flights, flights) : existingRef?.flights
  };

  // Clean up undefined fields
  if (!reference.travelers) delete reference.travelers;
  if (!reference.dates) delete reference.dates;
  if (!reference.cruise) delete reference.cruise;
  if (!reference.lodging) delete reference.lodging;
  if (!reference.flights) delete reference.flights;

  // Save to KV
  await env.TRIPS.put(referenceKey, JSON.stringify(reference));

  // Build summary
  const summary: string[] = [];
  if (reference.travelers) summary.push(`${reference.travelers.length} traveler(s)`);
  if (reference.dates) summary.push('trip dates');
  if (reference.cruise) summary.push(`cruise (${reference.cruise.ports?.length || 0} ports)`);
  if (reference.lodging) summary.push(`${reference.lodging.length} lodging booking(s)`);
  if (reference.flights) summary.push(`${reference.flights.length} flight(s)`);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        tripId,
        version: reference.version,
        source: `${newSource.provider} (${newSource.type})`,
        contains: summary.join(', ') || 'no data',
        message: `Reference updated for trip "${tripId}". Version ${reference.version}.`,
        tip: 'Use validate_trip to check if the trip itinerary aligns with this reference.'
      }, null, 2)
    }]
  };
}

/**
 * Get trip reference data
 */
export async function getReference(
  args: Record<string, any>,
  env: Env,
  keyPrefix: string,
  _userProfile: UserProfile | null
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { tripId } = args;

  if (!tripId) {
    return { content: [{ type: 'text', text: 'Error: tripId is required' }] };
  }

  const referenceKey = `${keyPrefix}${tripId}/_reference`;
  const reference = await env.TRIPS.get(referenceKey, 'json') as TripReference | null;

  if (!reference) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          tripId,
          hasReference: false,
          message: `No reference data found for trip "${tripId}". Use set_reference to add confirmed booking data.`
        }, null, 2)
      }]
    };
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        tripId,
        hasReference: true,
        reference
      }, null, 2)
    }]
  };
}

/**
 * Validate trip against reference
 */
export async function validateTrip(
  args: Record<string, any>,
  env: Env,
  keyPrefix: string,
  _userProfile: UserProfile | null
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { tripId } = args;

  if (!tripId) {
    return { content: [{ type: 'text', text: 'Error: tripId is required' }] };
  }

  // Get reference
  const referenceKey = `${keyPrefix}${tripId}/_reference`;
  const reference = await env.TRIPS.get(referenceKey, 'json') as TripReference | null;

  // Get trip data
  const tripKey = `${keyPrefix}${tripId}`;
  const tripData = await env.TRIPS.get(tripKey, 'json') as any;

  if (!tripData) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          valid: false,
          tripId,
          hasReference: !!reference,
          error: `Trip "${tripId}" not found`
        }, null, 2)
      }]
    };
  }

  if (!reference) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          valid: true,
          tripId,
          hasReference: false,
          checkedAt: new Date().toISOString(),
          drift: [],
          warnings: ['No reference data to validate against. Consider adding confirmed booking data with set_reference.'],
          summary: 'No reference data available for validation.'
        }, null, 2)
      }]
    };
  }

  // Perform validation
  const drift: ValidationDrift[] = [];
  const warnings: string[] = [];

  // Validate dates
  if (reference.dates) {
    const tripDates = tripData.dates || {};

    if (reference.dates.tripStart && tripDates.start !== reference.dates.tripStart) {
      drift.push({
        field: 'dates.start',
        category: 'date',
        severity: 'error',
        reference: reference.dates.tripStart,
        actual: tripDates.start || null,
        message: `Trip start date mismatch: reference says ${reference.dates.tripStart}, trip has ${tripDates.start || 'not set'}`
      });
    }

    if (reference.dates.tripEnd && tripDates.end !== reference.dates.tripEnd) {
      drift.push({
        field: 'dates.end',
        category: 'date',
        severity: 'error',
        reference: reference.dates.tripEnd,
        actual: tripDates.end || null,
        message: `Trip end date mismatch: reference says ${reference.dates.tripEnd}, trip has ${tripDates.end || 'not set'}`
      });
    }
  }

  // Validate cruise ports
  if (reference.cruise?.ports) {
    const tripPorts = tripData.ports || [];
    const tripItinerary = tripData.itinerary || [];

    for (const refPort of reference.cruise.ports) {
      // Find matching port in trip data by date
      const matchingTripPort = tripPorts.find((p: any) =>
        normalizeDate(p.date) === normalizeDate(refPort.date)
      );

      // Find matching itinerary day by date
      const matchingItineraryDay = tripItinerary.find((d: any) =>
        normalizeDate(d.date) === normalizeDate(refPort.date)
      );

      if (!matchingTripPort && !matchingItineraryDay) {
        drift.push({
          field: `ports[${refPort.date}]`,
          category: 'port',
          severity: 'error',
          reference: `${refPort.port} on ${refPort.date}`,
          actual: null,
          message: `Missing port day: reference has ${refPort.port} on ${refPort.date}, but no matching day found in trip`
        });
        continue;
      }

      // Check port name matches (if trip has ports array)
      if (matchingTripPort) {
        const tripPortName = matchingTripPort.port || matchingTripPort.name || '';
        if (!portNamesMatch(refPort.port, tripPortName)) {
          drift.push({
            field: `ports[${refPort.date}].port`,
            category: 'port',
            severity: 'warning',
            reference: refPort.port,
            actual: tripPortName,
            message: `Port name mismatch on ${refPort.date}: reference says "${refPort.port}", trip has "${tripPortName}"`
          });
        }

        // Check arrival time
        if (refPort.arrive && matchingTripPort.arrival !== refPort.arrive && matchingTripPort.arrive !== refPort.arrive) {
          const actualArrival = matchingTripPort.arrival || matchingTripPort.arrive;
          if (actualArrival && !timesMatch(refPort.arrive, actualArrival)) {
            drift.push({
              field: `ports[${refPort.date}].arrive`,
              category: 'port',
              severity: 'warning',
              reference: refPort.arrive,
              actual: actualArrival,
              message: `Arrival time mismatch at ${refPort.port} on ${refPort.date}: reference says ${refPort.arrive}, trip has ${actualArrival}`
            });
          }
        }

        // Check departure time
        if (refPort.depart && matchingTripPort.departure !== refPort.depart && matchingTripPort.depart !== refPort.depart) {
          const actualDeparture = matchingTripPort.departure || matchingTripPort.depart;
          if (actualDeparture && !timesMatch(refPort.depart, actualDeparture)) {
            drift.push({
              field: `ports[${refPort.date}].depart`,
              category: 'port',
              severity: 'warning',
              reference: refPort.depart,
              actual: actualDeparture,
              message: `Departure time mismatch at ${refPort.port} on ${refPort.date}: reference says ${refPort.depart}, trip has ${actualDeparture}`
            });
          }
        }
      }
    }
  }

  // Validate lodging
  if (reference.lodging) {
    const tripLodging = tripData.lodging || [];

    for (const refLodge of reference.lodging) {
      const matchingLodge = tripLodging.find((l: any) =>
        normalizeDate(l.checkIn || l.dates) === normalizeDate(refLodge.checkIn) ||
        (l.name && l.name.toLowerCase().includes(refLodge.name.toLowerCase()))
      );

      if (!matchingLodge) {
        drift.push({
          field: `lodging[${refLodge.name}]`,
          category: 'lodging',
          severity: 'error',
          reference: `${refLodge.name} (${refLodge.checkIn} - ${refLodge.checkOut})`,
          actual: null,
          message: `Missing lodging: reference has ${refLodge.name} from ${refLodge.checkIn} to ${refLodge.checkOut}`
        });
      }
    }
  }

  // Build result
  const errors = drift.filter(d => d.severity === 'error');
  const result: ValidationResult = {
    valid: errors.length === 0,
    checkedAt: new Date().toISOString(),
    tripId,
    hasReference: true,
    drift,
    warnings,
    summary: errors.length === 0
      ? `Trip aligns with reference. ${drift.length > 0 ? `${drift.length} minor warning(s).` : 'No issues found.'}`
      : `Found ${errors.length} error(s) and ${drift.length - errors.length} warning(s). Trip does not match confirmed reference data.`
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}

// Helper functions

function mergeCruiseRef(existing: any, incoming: any): any {
  if (!existing) return incoming;
  return {
    ...existing,
    ...incoming,
    embarkation: incoming.embarkation || existing.embarkation,
    debarkation: incoming.debarkation || existing.debarkation,
    ports: incoming.ports || existing.ports
  };
}

function mergeLodgingRef(existing: any[] | undefined, incoming: any[]): any[] {
  if (!existing) return incoming;
  // Merge by check-in date, replacing if same date
  const merged = [...existing];
  for (const newLodge of incoming) {
    const existingIdx = merged.findIndex(l =>
      normalizeDate(l.checkIn) === normalizeDate(newLodge.checkIn)
    );
    if (existingIdx >= 0) {
      merged[existingIdx] = newLodge;
    } else {
      merged.push(newLodge);
    }
  }
  return merged;
}

function mergeFlightsRef(existing: any[] | undefined, incoming: any[]): any[] {
  if (!existing) return incoming;
  // Merge by date + type, replacing if same
  const merged = [...existing];
  for (const newFlight of incoming) {
    const existingIdx = merged.findIndex(f =>
      normalizeDate(f.date) === normalizeDate(newFlight.date) && f.type === newFlight.type
    );
    if (existingIdx >= 0) {
      merged[existingIdx] = newFlight;
    } else {
      merged.push(newFlight);
    }
  }
  return merged;
}

function normalizeDate(dateStr: string | undefined): string | null {
  if (!dateStr) return null;

  const str = dateStr.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Parse common formats
  const monthNames: Record<string, number> = {
    'jan': 1, 'january': 1, 'feb': 2, 'february': 2, 'mar': 3, 'march': 3,
    'apr': 4, 'april': 4, 'may': 5, 'jun': 6, 'june': 6, 'jul': 7, 'july': 7,
    'aug': 8, 'august': 8, 'sep': 9, 'september': 9, 'oct': 10, 'october': 10,
    'nov': 11, 'november': 11, 'dec': 12, 'december': 12
  };

  // Match "May 29, 2026" or "May 29 2026" or "May 29"
  const match1 = str.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i);
  if (match1) {
    const month = monthNames[match1[1].toLowerCase()];
    const day = parseInt(match1[2], 10);
    const year = match1[3] ? parseInt(match1[3], 10) : 2026;
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Match "29 May 2026"
  const match2 = str.match(/^(\d{1,2})\s+([a-z]+)(?:,?\s+(\d{4}))?$/i);
  if (match2) {
    const day = parseInt(match2[1], 10);
    const month = monthNames[match2[2].toLowerCase()];
    const year = match2[3] ? parseInt(match2[3], 10) : 2026;
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

function portNamesMatch(ref: string, actual: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const refNorm = normalize(ref);
  const actualNorm = normalize(actual);
  return refNorm.includes(actualNorm) || actualNorm.includes(refNorm);
}

function timesMatch(ref: string, actual: string): boolean {
  // Normalize times for comparison (handle 08:00 vs 8:00 AM vs 8:00)
  const normalize = (t: string) => {
    const match = t.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (!match) return t;
    let hour = parseInt(match[1], 10);
    const min = match[2] || '00';
    const ampm = match[3]?.toLowerCase();
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}`;
  };
  return normalize(ref) === normalize(actual);
}
