/**
 * Trip summary computation and caching
 * Provides compact summaries of trip data for quick listing
 */

import type { Env } from '../types';

export const TRIP_SUMMARY_VERSION = 2;
const TRIP_SUMMARY_MAX_CONFIRMATIONS = 3;
const TRIP_SUMMARY_MAX_NEXT_STEPS = 3;
const TRIP_SUMMARY_DUE_SOON_DAYS = 30;

export type TripSummary = {
  summaryVersion: number;
  tripId: string;
  title: string;
  destination: string | null;
  dates: { start: string | null; end: string | null; label?: string | null };
  phase: string | null;
  status: string | null;
  travelers: { count: number; ageBands?: Record<string, number> | null };
  bookings: {
    counts: Record<string, number>;
    status: Record<string, number>;
    confirmations: Array<{
      type: string;
      supplier: string | null;
      codeLast4: string;
      status: string | null;
      balanceDue: string | null;
    }>;
    nextDue: { amount: number | null; date: string; item: string | null } | null;
  };
  pricing: {
    estimateTotal: number | null;
    perPerson: number | null;
    bookedTotal: number | null;
    paidTotal: number | null;
    outstanding: number | null;
  };
  nextSteps: string[];
  updatedAt: string;
  sourceHash: string;
  isTest: boolean;
  isArchived: boolean;
};

function getTripSummaryKey(keyPrefix: string, tripId: string): string {
  return `${keyPrefix}${tripId}/_summary`;
}

export function normalizeBookingType(value: any): string {
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  if (raw.includes('flight') || raw.includes('air')) return 'flight';
  if (raw.includes('hotel') || raw.includes('lodg')) return 'lodging';
  if (raw.includes('car')) return 'car';
  if (raw.includes('tour') || raw.includes('activity') || raw.includes('excursion')) return 'tour';
  if (raw.includes('cruise')) return 'cruise';
  if (raw.includes('package')) return 'package';
  return 'other';
}

export function normalizeBookingStatus(value: any): 'confirmed' | 'pending' | 'canceled' | null {
  if (typeof value !== 'string') return null;
  const raw = value.toLowerCase();
  if (['confirmed', 'booked', 'paid', 'ticketed'].includes(raw)) return 'confirmed';
  if (['pending', 'hold', 'reserved', 'proposed'].includes(raw)) return 'pending';
  if (['canceled', 'cancelled', 'void'].includes(raw)) return 'canceled';
  return null;
}

function coerceNumber(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDate(value: any): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function getConfirmationLast4(value: any): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (raw.length < 4) return null;
  return raw.slice(-4);
}

function computeAgeBands(details: any[]): Record<string, number> | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const bands = { child: 0, adult: 0, senior: 0 };
  let hasAge = false;

  for (const detail of details) {
    const age = coerceNumber(detail?.age);
    if (age === null) continue;
    hasAge = true;
    if (age < 18) {
      bands.child += 1;
    } else if (age >= 65) {
      bands.senior += 1;
    } else {
      bands.adult += 1;
    }
  }

  if (!hasAge) return null;
  return bands;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function computeTripSourceHash(tripData: any): Promise<string> {
  const meta = tripData?.meta || {};
  const canonical = {
    meta: {
      tripId: meta.tripId ?? null,
      clientName: meta.clientName ?? null,
      destination: meta.destination ?? null,
      dates: meta.dates ?? null,
      phase: meta.phase ?? null,
      status: meta.status ?? null,
      lastModified: meta.lastModified ?? meta.lastUpdated ?? null
    },
    dates: {
      start: tripData?.dates?.start ?? null,
      end: tripData?.dates?.end ?? null,
      flexible: tripData?.dates?.flexible ?? null
    },
    travelers: {
      count: tripData?.travelers?.count ?? null,
      ages: Array.isArray(tripData?.travelers?.details)
        ? tripData.travelers.details.map((detail: any) => detail?.age ?? null)
        : []
    },
    budget: {
      perPerson: tripData?.budget?.perPerson ?? null,
      total: tripData?.budget?.total ?? null
    },
    flights: {
      outbound: tripData?.flights?.outbound ?? null,
      return: tripData?.flights?.return ?? null
    },
    lodging: Array.isArray(tripData?.lodging)
      ? tripData.lodging.map((item: any) => ({
          name: item?.name ?? null,
          dates: item?.dates ?? null,
          confirmed: item?.confirmed ?? null
        }))
      : [],
    bookings: Array.isArray(tripData?.bookings)
      ? tripData.bookings.map((booking: any) => ({
          type: booking?.type ?? null,
          supplier: booking?.supplier ?? null,
          status: booking?.status ?? null,
          confirmation: booking?.confirmation ?? null,
          totalPrice: booking?.totalPrice ?? booking?.amount ?? booking?.total ?? null,
          depositPaid: booking?.depositPaid ?? booking?.amountPaid ?? booking?.paid ?? null,
          balanceDue: booking?.balanceDue ?? null
        }))
      : []
  };

  return sha256Hex(JSON.stringify(canonical));
}

/**
 * Compute a trip summary from trip data
 */
export async function computeTripSummary(tripId: string, tripData: any): Promise<TripSummary> {
  const meta = tripData?.meta || {};
  const dates = tripData?.dates || {};
  const travelers = tripData?.travelers || {};
  const bookings = Array.isArray(tripData?.bookings) ? tripData.bookings : [];
  const lodging = Array.isArray(tripData?.lodging) ? tripData.lodging : [];
  const sourceHash = await computeTripSourceHash(tripData);
  const title = meta.clientName || meta.destination || tripId;
  const destination = meta.destination || null;
  const dateStart = dates.start || null;
  const dateEnd = dates.end || null;
  const dateLabel = meta.dates || null;
  const updatedAt = meta.lastModified || meta.lastUpdated || new Date().toISOString();

  const counts: Record<string, number> = {
    flight: 0,
    lodging: 0,
    car: 0,
    tour: 0,
    cruise: 0,
    package: 0,
    other: 0
  };
  const statusCounts: Record<string, number> = {
    confirmed: 0,
    pending: 0,
    canceled: 0
  };

  const confirmations: TripSummary['bookings']['confirmations'] = [];
  let bookedTotal: number | null = null;
  let paidTotal: number | null = null;
  let nextDue: TripSummary['bookings']['nextDue'] = null;
  let nextDueTimestamp: number | null = null;

  for (const booking of bookings) {
    const type = normalizeBookingType(booking?.type);
    counts[type] = (counts[type] || 0) + 1;

    const status = normalizeBookingStatus(booking?.status);
    if (status) {
      statusCounts[status] += 1;
    } else {
      statusCounts.pending += 1;
    }

    const total = coerceNumber(booking?.totalPrice ?? booking?.amount ?? booking?.total);
    const paid = coerceNumber(booking?.depositPaid ?? booking?.amountPaid ?? booking?.paid);
    if (total !== null) {
      bookedTotal = (bookedTotal ?? 0) + total;
    }
    if (paid !== null) {
      paidTotal = (paidTotal ?? 0) + paid;
    }

    const confirmationLast4 = getConfirmationLast4(booking?.confirmation);
    if (confirmationLast4 && confirmations.length < TRIP_SUMMARY_MAX_CONFIRMATIONS) {
      confirmations.push({
        type,
        supplier: booking?.supplier || booking?.operator || booking?.name || null,
        codeLast4: confirmationLast4,
        status: booking?.status || null,
        balanceDue: booking?.balanceDue || null
      });
    }

    const balanceDueTimestamp = parseDate(booking?.balanceDue);
    if (balanceDueTimestamp !== null) {
      if (nextDueTimestamp === null || balanceDueTimestamp < nextDueTimestamp) {
        const outstanding = total !== null && paid !== null ? total - paid : null;
        nextDueTimestamp = balanceDueTimestamp;
        nextDue = {
          amount: outstanding,
          date: booking.balanceDue,
          item: booking?.supplier || booking?.operator || booking?.name || booking?.type || null
        };
      }
    }
  }

  const estimateTotal = coerceNumber(tripData?.budget?.total);
  const perPerson = coerceNumber(tripData?.budget?.perPerson);
  const outstanding = bookedTotal !== null && paidTotal !== null ? bookedTotal - paidTotal : null;

  const nextStepsSet = new Set<string>();
  const hasFlightsPlan = !!(tripData?.flights?.outbound || tripData?.flights?.return);
  const hasFlightBooking = bookings.some((booking: any) => {
    const type = normalizeBookingType(booking?.type);
    const status = normalizeBookingStatus(booking?.status);
    return type === 'flight' && status === 'confirmed';
  });
  if (!hasFlightsPlan) {
    nextStepsSet.add('Add flight options');
  } else if (!hasFlightBooking) {
    nextStepsSet.add('Confirm flights');
  }

  const hasLodgingPlan = lodging.length > 0;
  const hasLodgingBooking = bookings.some((booking: any) => {
    const type = normalizeBookingType(booking?.type);
    const status = normalizeBookingStatus(booking?.status);
    return type === 'lodging' && status === 'confirmed';
  }) || lodging.some((item: any) => item?.confirmed);
  if (!hasLodgingPlan) {
    nextStepsSet.add('Select lodging');
  } else if (!hasLodgingBooking) {
    nextStepsSet.add('Confirm lodging');
  }

  const travelerCount = travelers?.count ?? 0;
  if (!travelerCount) {
    nextStepsSet.add('Confirm traveler count');
  }

  if (nextDue && nextDueTimestamp !== null) {
    const dueSoonLimit = Date.now() + TRIP_SUMMARY_DUE_SOON_DAYS * 24 * 60 * 60 * 1000;
    if (nextDueTimestamp <= dueSoonLimit) {
      const item = nextDue.item ? `${nextDue.item}` : 'booking';
      nextStepsSet.add(`Pay balance: ${item} by ${nextDue.date}`);
    }
  }

  return {
    summaryVersion: TRIP_SUMMARY_VERSION,
    tripId,
    title,
    destination,
    dates: {
      start: dateStart,
      end: dateEnd,
      label: dateStart || dateEnd ? null : dateLabel
    },
    phase: meta.phase || null,
    status: meta.status || null,
    travelers: {
      count: travelerCount,
      ageBands: computeAgeBands(travelers?.details) || null
    },
    bookings: {
      counts,
      status: statusCounts,
      confirmations,
      nextDue
    },
    pricing: {
      estimateTotal,
      perPerson,
      bookedTotal,
      paidTotal,
      outstanding
    },
    nextSteps: Array.from(nextStepsSet).slice(0, TRIP_SUMMARY_MAX_NEXT_STEPS),
    updatedAt,
    sourceHash,
    isTest: !!meta.isTest,
    isArchived: !!meta.isArchived
  };
}

/**
 * Write trip summary to KV cache
 */
export async function writeTripSummary(
  env: Env,
  keyPrefix: string,
  tripId: string,
  summary: TripSummary,
  ctx?: ExecutionContext
): Promise<void> {
  const summaryKey = getTripSummaryKey(keyPrefix, tripId);
  const write = env.TRIPS.put(summaryKey, JSON.stringify(summary));
  if (ctx) {
    ctx.waitUntil(write);
  } else {
    await write;
  }
}

/**
 * Delete trip summary from KV cache
 */
export async function deleteTripSummary(
  env: Env,
  keyPrefix: string,
  tripId: string,
  ctx?: ExecutionContext
): Promise<void> {
  const summaryKey = getTripSummaryKey(keyPrefix, tripId);
  const del = env.TRIPS.delete(summaryKey);
  if (ctx) {
    ctx.waitUntil(del);
  } else {
    await del;
  }
}

/**
 * Get trip summary from cache or compute it
 */
export async function getOrComputeTripSummary(
  env: Env,
  keyPrefix: string,
  tripId: string,
  ctx?: ExecutionContext
): Promise<TripSummary | null> {
  const summaryKey = getTripSummaryKey(keyPrefix, tripId);
  const existing = await env.TRIPS.get(summaryKey, "json") as TripSummary | null;
  if (existing && existing.summaryVersion === TRIP_SUMMARY_VERSION) {
    return existing;
  }

  const tripData = await env.TRIPS.get(`${keyPrefix}${tripId}`, "json");
  if (!tripData) return null;

  const summary = await computeTripSummary(tripId, tripData);
  await writeTripSummary(env, keyPrefix, tripId, summary, ctx);
  return summary;
}

/**
 * Get multiple trip summaries in parallel
 */
export async function getTripSummaries(
  env: Env,
  keyPrefix: string,
  tripIds: string[],
  ctx?: ExecutionContext
): Promise<TripSummary[]> {
  const summaries = await Promise.all(
    tripIds.map(tripId => getOrComputeTripSummary(env, keyPrefix, tripId, ctx))
  );
  return summaries.filter(Boolean) as TripSummary[];
}
