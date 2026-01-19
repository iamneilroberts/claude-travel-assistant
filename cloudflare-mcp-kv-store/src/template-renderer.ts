/**
 * Shared template rendering logic for Voygent
 * Used by both preview_publish and publish_trip tools
 */

import { renderTemplate } from './simple-template';
import type { Env, UserProfile, AgentInfo } from './types';

const DEFAULT_AGENT: AgentInfo = {
  name: 'Travel Agent',
  agency: 'Travel Agency',
};

/**
 * Format a date for hold expiration display (e.g., "Jan 25")
 */
function formatHoldDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  } catch {
    return dateStr;
  }
}

/**
 * Add Viator affiliate tracking parameters to a URL
 */
function addViatorTracking(url: string, userProfile: UserProfile | null): string {
  if (!url || !url.includes('viator.com')) return url;

  // Get affiliate params from user profile
  const viatorAffiliates = userProfile?.affiliates?.viator;
  if (!viatorAffiliates?.partnerId) return url; // No affiliate tracking configured

  try {
    const urlObj = new URL(url);
    // Don't add if already has tracking
    if (urlObj.searchParams.has('pid')) return url;

    urlObj.searchParams.set('pid', viatorAffiliates.partnerId);
    if (viatorAffiliates.campaignId) {
      urlObj.searchParams.set('mcid', viatorAffiliates.campaignId);
    }
    urlObj.searchParams.set('medium', 'link');
    return urlObj.toString();
  } catch {
    // If URL parsing fails, append manually
    const separator = url.includes('?') ? '&' : '?';
    let params = `pid=${viatorAffiliates.partnerId}`;
    if (viatorAffiliates.campaignId) {
      params += `&mcid=${viatorAffiliates.campaignId}`;
    }
    return `${url}${separator}${params}&medium=link`;
  }
}

/**
 * Process all Viator URLs in trip data to add affiliate tracking
 */
function processViatorUrls(tripData: any, userProfile: UserProfile | null): any {
  if (!userProfile?.affiliates?.viator?.partnerId) {
    return tripData; // No affiliate tracking configured, return unchanged
  }

  // Process viatorTours object (by port)
  if (tripData.viatorTours && typeof tripData.viatorTours === 'object') {
    for (const portKey of Object.keys(tripData.viatorTours)) {
      if (portKey === 'description') continue;
      const tours = tripData.viatorTours[portKey];
      if (Array.isArray(tours)) {
        tripData.viatorTours[portKey] = tours.map((tour: any) => ({
          ...tour,
          url: addViatorTracking(tour.url, userProfile),
          bookingUrl: addViatorTracking(tour.bookingUrl, userProfile)
        }));
      }
    }
  }

  // Process excursions that are from Viator
  if (tripData.excursions && Array.isArray(tripData.excursions)) {
    tripData.excursions = tripData.excursions.map((exc: any) => {
      if (exc.provider?.toLowerCase() === 'viator' || exc.providerType === 'viator' || exc.url?.includes('viator.com')) {
        return {
          ...exc,
          url: addViatorTracking(exc.url, userProfile)
        };
      }
      return exc;
    });
  }

  // Process recommended extras
  if (tripData.recommendedExtras && Array.isArray(tripData.recommendedExtras)) {
    tripData.recommendedExtras = tripData.recommendedExtras.map((extra: any) => {
      if (extra.url?.includes('viator.com')) {
        return {
          ...extra,
          url: addViatorTracking(extra.url, userProfile)
        };
      }
      return extra;
    });
  }

  // Process itinerary activities
  if (tripData.itinerary && Array.isArray(tripData.itinerary)) {
    tripData.itinerary = tripData.itinerary.map((day: any) => {
      if (day.activities && Array.isArray(day.activities)) {
        day.activities = day.activities.map((activity: any) => {
          if (activity.url?.includes('viator.com')) {
            return {
              ...activity,
              url: addViatorTracking(activity.url, userProfile)
            };
          }
          return activity;
        });
      }
      if (day.excursions && Array.isArray(day.excursions)) {
        day.excursions = day.excursions.map((exc: any) => {
          if (exc.provider?.toLowerCase() === 'viator' || exc.providerType === 'viator' || exc.url?.includes('viator.com')) {
            return {
              ...exc,
              url: addViatorTracking(exc.url, userProfile)
            };
          }
          return exc;
        });
      }
      return day;
    });
  }

  return tripData;
}

/**
 * Build agent info from user profile or return defaults
 */
export function buildAgentInfo(userProfile: UserProfile | null): AgentInfo {
  if (!userProfile) return DEFAULT_AGENT;

  return {
    name: userProfile.name,
    email: userProfile.email,
    phone: userProfile.phone,
    agency: userProfile.agency.name,
    franchise: userProfile.agency.franchise,
    logo: userProfile.agency.logo,
    website: userProfile.agency.website,
    bookingUrl: userProfile.agency.bookingUrl,
    primaryColor: userProfile.branding?.primaryColor,
    accentColor: userProfile.branding?.accentColor
  };
}

/**
 * Normalize a date string to YYYY-MM-DD format for consistent matching.
 * Handles formats like "May 29, 2026", "May 29", "2026-05-29", "29 May 2026"
 */
function normalizeDate(dateStr: string | undefined, fallbackYear?: number): string | null {
  if (!dateStr) return null;

  const str = dateStr.trim();

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Try parsing with Date object
  const monthNames: Record<string, number> = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11
  };

  // Match "May 29, 2026" or "May 29 2026" or "May 29"
  const match1 = str.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i);
  if (match1) {
    const month = monthNames[match1[1].toLowerCase()];
    const day = parseInt(match1[2], 10);
    const year = match1[3] ? parseInt(match1[3], 10) : (fallbackYear || new Date().getFullYear());
    if (month !== undefined && day >= 1 && day <= 31) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Match "29 May 2026" or "29 May"
  const match2 = str.match(/^(\d{1,2})\s+([a-z]+)(?:,?\s+(\d{4}))?$/i);
  if (match2) {
    const day = parseInt(match2[1], 10);
    const month = monthNames[match2[2].toLowerCase()];
    const year = match2[3] ? parseInt(match2[3], 10) : (fallbackYear || new Date().getFullYear());
    if (month !== undefined && day >= 1 && day <= 31) {
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Build a unified timeline that merges:
 * - Pre-cruise: arrival flights, pre-cruise hotels
 * - Cruise days: ports of call merged with itinerary days
 * - Post-cruise: debarkation, post-cruise hotels, return flights
 *
 * IMPORTANT: Matches ports to itinerary by DATE, not by day number.
 * This handles cases where ports[] uses cruise day numbering (day 1 = embarkation)
 * while itinerary[] uses trip day numbering (day 1 = arrival day before cruise).
 */
function buildUnifiedTimeline(tripData: any): any[] {
  const timeline: any[] = [];
  // Ports can be at root level OR inside cruiseInfo
  const ports = tripData?.ports || tripData?.cruiseInfo?.ports || [];
  const itinerary = tripData?.itinerary || [];
  const lodging = tripData?.lodging || [];
  const flights = tripData?.flights;
  const embarkation = tripData?.cruiseInfo?.embarkation;
  const debarkation = tripData?.cruiseInfo?.debarkation;

  // Determine fallback year from trip dates
  const startDate = tripData?.dates?.start;
  const fallbackYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();

  // Create a map of ports by NORMALIZED DATE for accurate matching
  const portsByDate: Record<string, any> = {};
  ports.forEach((port: any) => {
    const normalizedDate = normalizeDate(port.date, fallbackYear);
    if (normalizedDate) {
      portsByDate[normalizedDate] = port;
    }
  });

  // Find pre-cruise and post-cruise lodging
  const preCruiseLodging = lodging.filter((l: any) =>
    l.type?.toLowerCase() === 'pre-cruise' ||
    l.timing?.toLowerCase() === 'pre-cruise' ||
    l.category?.toLowerCase() === 'pre-cruise'
  );
  const postCruiseLodging = lodging.filter((l: any) =>
    l.type?.toLowerCase() === 'post-cruise' ||
    l.timing?.toLowerCase() === 'post-cruise' ||
    l.category?.toLowerCase() === 'post-cruise'
  );

  // If no itinerary, return empty timeline
  if (itinerary.length === 0) {
    return [];
  }

  // Use itinerary as the source of truth - iterate through each itinerary day
  itinerary.forEach((itineraryDay: any) => {
    const dayNum = itineraryDay.day;
    const itineraryDate = normalizeDate(itineraryDay.date, fallbackYear);

    // Find matching port by DATE (not by day number!)
    const port = itineraryDate ? portsByDate[itineraryDate] : null;

    // Determine day type based on port info and content
    let dayType = 'cruise';
    const portDesc = (port?.description || '').toLowerCase();
    const portName = (port?.name || port?.port || port?.location || '').toLowerCase();
    const itineraryTitle = (itineraryDay?.title || itineraryDay?.location || '').toLowerCase();
    const combined = `${portDesc} ${portName} ${itineraryTitle}`;

    // Check if this is a pre-cruise day (arrival, before embarkation)
    const isPreCruiseDay = preCruiseLodging.some((l: any) => {
      const lodgingDate = normalizeDate(l.dates || l.date || l.checkIn, fallbackYear);
      return lodgingDate === itineraryDate;
    }) || combined.includes('arrive') || combined.includes('arrival');

    // Check if this is a post-cruise day (after debarkation)
    const isPostCruiseDay = postCruiseLodging.some((l: any) => {
      const lodgingDate = normalizeDate(l.dates || l.date || l.checkIn, fallbackYear);
      return lodgingDate === itineraryDate;
    }) || combined.includes('depart') || combined.includes('departure') || combined.includes('fly home');

    if (isPreCruiseDay && !port) {
      dayType = 'pre-cruise';
    } else if (isPostCruiseDay && !port) {
      dayType = 'post-cruise';
    } else if (port?.type?.toLowerCase() === 'embarkation' || port?.isEmbarkation || combined.includes('embarkation') || combined.includes('embark day')) {
      dayType = 'embarkation';
    } else if (port?.type?.toLowerCase() === 'debarkation' || port?.isDebarkation || combined.includes('debarkation') || combined.includes('disembark')) {
      dayType = 'debarkation';
    } else if (port?.type?.toLowerCase() === 'sea' || portName === 'at sea' || combined.includes('at sea') || combined.includes('cruising')) {
      dayType = 'sea-day';
    } else if (port?.name || port?.port || port?.location) {
      dayType = 'port-day';
    }

    const unifiedDay: any = {
      dayNumber: dayNum,
      dayType,
      isPreCruise: dayType === 'pre-cruise',
      isPostCruise: dayType === 'post-cruise',
      title: itineraryDay?.title || itineraryDay?.location || port?.name || port?.port || port?.location || `Day ${dayNum}`,
      date: itineraryDay?.date,
      description: itineraryDay?.description
    };

    // Add port info only if we found a matching port by date
    if (port) {
      unifiedDay.port = {
        name: port.name || port.port || port.location,
        country: port.country,
        arrival: port.arrival || port.arrive,
        departure: port.departure || port.depart,
        description: port.description,
        highlights: port.highlights
      };
    }

    // Also check for portInfo embedded in the itinerary day itself
    if (itineraryDay?.portInfo) {
      unifiedDay.port = {
        ...unifiedDay.port,
        name: unifiedDay.port?.name || itineraryDay.portInfo.name || itineraryDay.portInfo.port,
        arrival: unifiedDay.port?.arrival || itineraryDay.portInfo.arrival || itineraryDay.portInfo.arrive,
        departure: unifiedDay.port?.departure || itineraryDay.portInfo.departure || itineraryDay.portInfo.depart,
        description: unifiedDay.port?.description || itineraryDay.portInfo.description
      };
    }

    // Add embarkation info
    if (dayType === 'embarkation' && embarkation) {
      unifiedDay.embarkation = {
        port: embarkation.port,
        time: embarkation.time,
        checkIn: embarkation.checkIn
      };
    }

    // Add debarkation info
    if (dayType === 'debarkation' && debarkation) {
      unifiedDay.debarkation = {
        port: debarkation.port,
        time: debarkation.time
      };
    }

    // Add flight info for pre/post cruise days
    if (dayType === 'pre-cruise' && flights?.outbound) {
      unifiedDay.flight = {
        type: 'arrival',
        ...flights.outbound
      };
    }
    if (dayType === 'post-cruise' && flights?.return) {
      unifiedDay.flight = {
        type: 'departure',
        ...flights.return
      };
    }

    // Add hotel info for pre/post cruise days
    if (dayType === 'pre-cruise' && preCruiseLodging.length > 0) {
      unifiedDay.hotel = preCruiseLodging[0];
    }
    if (dayType === 'post-cruise' && postCruiseLodging.length > 0) {
      unifiedDay.hotel = postCruiseLodging[0];
    }

    // Merge activities from itinerary
    if (itineraryDay?.activities) {
      unifiedDay.activities = itineraryDay.activities;
    }

    // Merge schedule from itinerary
    if (itineraryDay?.schedule) {
      unifiedDay.schedule = itineraryDay.schedule;
    }

    // Merge dining info
    if (itineraryDay?.dining) {
      unifiedDay.dining = itineraryDay.dining;
    }

    // Merge highlights (combine port + itinerary highlights)
    const combinedHighlights: string[] = [];
    if (port?.highlights && Array.isArray(port.highlights)) {
      combinedHighlights.push(...port.highlights);
    }
    if (itineraryDay?.highlights && Array.isArray(itineraryDay.highlights)) {
      itineraryDay.highlights.forEach((h: string) => {
        if (!combinedHighlights.includes(h)) {
          combinedHighlights.push(h);
        }
      });
    }
    if (combinedHighlights.length > 0) {
      unifiedDay.highlights = combinedHighlights;
    }

    // Merge tips
    if (itineraryDay?.tips) {
      unifiedDay.tips = itineraryDay.tips;
    }

    // Merge shopping
    if (itineraryDay?.shopping) {
      unifiedDay.shopping = itineraryDay.shopping;
    }

    // Merge excursions
    if (itineraryDay?.excursions) {
      unifiedDay.excursions = itineraryDay.excursions;
    }

    // Merge cruise info (distance, locks, time)
    if (itineraryDay?.cruiseInfo) {
      unifiedDay.cruiseInfo = itineraryDay.cruiseInfo;
    }

    // Merge images
    if (itineraryDay?.images) {
      unifiedDay.images = itineraryDay.images;
    }

    // Merge videos
    if (itineraryDay?.videos) {
      unifiedDay.videos = itineraryDay.videos;
    }

    // Merge map
    if (itineraryDay?.map) {
      unifiedDay.map = itineraryDay.map;
    }

    // Merge lodging (for days with hotel stays, like embarkation/debarkation)
    if (itineraryDay?.lodging) {
      unifiedDay.lodging = itineraryDay.lodging;
    }

    timeline.push(unifiedDay);
  });

  return timeline;
}

/**
 * Template resolution order:
 * 1. User-specific template: {keyPrefix}_templates/{name}
 * 2. System template: _templates/{name}
 *
 * Templates must exist in KV - no built-in fallback.
 */
export async function getTemplateHtml(
  env: Env,
  templateName: string,
  keyPrefix?: string
): Promise<string> {
  // 1. Try user-specific template first (if keyPrefix provided)
  if (keyPrefix) {
    const userTemplate = await env.TRIPS.get(`${keyPrefix}_templates/${templateName}`, "text");
    if (userTemplate) {
      return userTemplate;
    }
  }

  // 2. Try system template
  const systemTemplate = await env.TRIPS.get(`_templates/${templateName}`, "text");
  if (systemTemplate) {
    return systemTemplate;
  }

  throw new Error(`Template '${templateName}' not found in KV. Upload it with: npx wrangler kv:key put "_templates/${templateName}" --path=<file> --namespace-id=aa119fcdabfe40858f1ce46a5fbf4563`);
}

/**
 * Resolve which template to use based on user profile and explicit request
 * If no template specified, uses user's default template from profile
 */
export function resolveTemplateName(
  requestedTemplate: string | undefined,
  userProfile: UserProfile | null
): string {
  // If explicitly requested, use that
  if (requestedTemplate && requestedTemplate !== "default") {
    return requestedTemplate;
  }

  // If user has a default template set, use it
  if (userProfile?.template && userProfile.template !== "default") {
    return userProfile.template;
  }

  // Fall back to "default"
  return "default";
}

/**
 * Build the complete template data object with config and computed values
 */
export function buildTemplateData(
  tripData: any,
  userProfile: UserProfile | null,
  env: Env,
  tripKey: string,
  commentSummary?: { commentCount: number; hasComments: boolean; commentCountLabel: string }
): any {
  // Process Viator URLs to add affiliate tracking
  tripData = processViatorUrls(tripData, userProfile);

  if (Array.isArray(tripData?.bookings)) {
    const typeLabels: Record<string, { label: string; icon: string }> = {
      cruise: { label: 'Cruise', icon: '🚢' },
      insurance: { label: 'Insurance', icon: '🛡️' },
      flight: { label: 'Flight', icon: '✈️' },
      hotel: { label: 'Hotel', icon: '🏨' }
    };
    const statusLabels: Record<string, { label: string; icon: string; className: string }> = {
      confirmed: { label: 'Confirmed', icon: '✓', className: 'confirmed' },
      quoted: { label: 'Quoted', icon: '⏳', className: 'quoted' },
      pending: { label: 'Pending', icon: '⏳', className: 'pending' },
      cancelled: { label: 'Cancelled', icon: '✗', className: 'cancelled' }
    };

    tripData.bookings = tripData.bookings.map((booking: any) => {
      const typeKey = typeof booking?.type === 'string' ? booking.type.toLowerCase() : '';
      const typeInfo = typeLabels[typeKey] || {
        label: typeKey ? typeKey.charAt(0).toUpperCase() + typeKey.slice(1) : 'Booking',
        icon: '📌'
      };
      const statusKey = typeof booking?.status === 'string' ? booking.status.toLowerCase() : '';
      let statusInfo = statusLabels[statusKey] || {
        label: statusKey ? statusKey.charAt(0).toUpperCase() + statusKey.slice(1) : '',
        icon: '',
        className: statusKey || 'pending'
      };

      // Handle "held" status with expiration date
      if (statusKey === 'held' && (booking.holdExpires || booking.holdUntil || booking.expiresDate)) {
        const holdDate = booking.holdExpires || booking.holdUntil || booking.expiresDate;
        const formattedDate = formatHoldDate(holdDate);
        statusInfo = {
          label: `Held until ${formattedDate}`,
          icon: '⏳',
          className: 'held'
        };
      }

      // Handle "options provided" for insurance quotes
      if (booking.type?.toLowerCase() === 'insurance' && (statusKey === 'quoted' || statusKey === 'options_provided' || !statusKey)) {
        statusInfo = {
          label: 'Options Provided',
          icon: '📋',
          className: 'quoted'
        };
      }
      const confirmationText = typeof booking?.confirmation === 'string'
        && booking.confirmation.toLowerCase() !== 'quote'
        ? booking.confirmation
        : '';

      // Handle travelers - can be array of strings, array of objects, or JSON string
      let travelersText = '';
      let travelersList = booking?.travelers;
      if (typeof travelersList === 'string') {
        // Try to parse JSON string
        try {
          travelersList = JSON.parse(travelersList);
        } catch {
          travelersText = travelersList; // Use as-is if not JSON
        }
      }
      if (Array.isArray(travelersList)) {
        travelersText = travelersList
          .map((t: any) => typeof t === 'string' ? t : (t?.name || ''))
          .filter(Boolean)
          .join(', ');
      }

      const balanceValue = booking?.balance;
      const balanceNumber = typeof balanceValue === 'number'
        ? balanceValue
        : (typeof balanceValue === 'string' ? Number(balanceValue) : NaN);
      const showBalance = Number.isFinite(balanceNumber) ? balanceNumber > 0 : !!balanceValue;

      // Remove travelers from spread to prevent template from rendering raw array
      const { travelers: _travelers, ...bookingRest } = booking;

      // For insurance bookings, include plan summary from travelInsurance data
      const isInsurance = typeKey === 'insurance';
      let insurancePlans: any[] = [];
      if (isInsurance && tripData.travelInsurance) {
        // Use plans or options array
        insurancePlans = tripData.travelInsurance.plans || tripData.travelInsurance.options || [];
      }

      return {
        ...bookingRest,
        typeLabel: typeInfo.label,
        typeIcon: typeInfo.icon,
        statusLabel: statusInfo.label,
        statusClass: statusInfo.className,
        statusBadge: statusInfo.label ? `${statusInfo.icon} ${statusInfo.label}`.trim() : '',
        confirmationDisplay: confirmationText,
        travelersText,
        showBalance,
        isInsurance,
        insurancePlans
      };
    });
  }

  if (Array.isArray(tripData?.recommendedExtras)) {
    const priorityOrder: Record<string, number> = {
      high: 0,
      recommended: 1,
      medium: 2,
      splurge: 3
    };
    const badgeLabels: Record<string, string> = {
      high: 'Popular',
      recommended: 'Agent Recommended',
      medium: 'Recommended',
      splurge: 'Upgrade'
    };

    tripData.recommendedExtras = tripData.recommendedExtras
      .map((extra: any) => {
        const priority = typeof extra?.priority === 'string'
          ? extra.priority.toLowerCase()
          : 'medium';
        const normalizedPriority = priorityOrder[priority] === undefined ? 'medium' : priority;
        return {
          ...extra,
          priority: normalizedPriority,
          priorityClass: normalizedPriority,
          badgeLabel: badgeLabels[normalizedPriority] || badgeLabels.medium
        };
      })
      .sort((a: any, b: any) => {
        const aOrder = priorityOrder[a.priority] ?? priorityOrder.medium;
        const bOrder = priorityOrder[b.priority] ?? priorityOrder.medium;
        return aOrder - bOrder;
      });
  }

  if (tripData?.viatorTours && typeof tripData.viatorTours === 'object') {
    const tours = tripData.viatorTours;
    const byPort = Object.entries(tours)
      .filter(([key, value]) => key !== 'description' && Array.isArray(value))
      .map(([key, value]) => ({
        portKey: key,
        portLabel: key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
        tours: value
      }));
    tripData.viatorToursByPort = byPort;
    tripData.viatorToursDescription = tours.description || '';
  }

  // Auto-recommend mid-price travel insurance option if none marked
  if (tripData?.travelInsurance?.options && Array.isArray(tripData.travelInsurance.options) && tripData.travelInsurance.options.length > 0) {
    const hasRecommended = tripData.travelInsurance.options.some((o: any) => o.recommended);
    if (!hasRecommended && tripData.travelInsurance.options.length >= 2) {
      // Mark middle option as recommended
      const midIndex = Math.floor(tripData.travelInsurance.options.length / 2);
      tripData.travelInsurance.options[midIndex].recommended = true;
    }
  }

  const tripMeta = tripData.meta || {};
  const agentInfo = buildAgentInfo(userProfile);
  const showTiers = typeof tripMeta.phase === 'string'
    ? tripMeta.phase.toLowerCase() !== 'confirmed'
    : true;
  const commentCount = commentSummary?.commentCount ?? 0;
  const hasComments = commentSummary?.hasComments ?? commentCount > 0;
  const commentCountLabel = commentSummary?.commentCountLabel
    ?? (commentCount === 1 ? '1 comment' : `${commentCount} comments`);

  // Extract tripId from tripKey (format: "prefix/tripId")
  const tripId = tripKey.includes('/') ? tripKey.split('/').pop() : tripKey;
  const commentThreadUrl = `https://voygent.somotravel.workers.dev/trips/${encodeURIComponent(tripId)}/comments`;

  // Build unified timeline (merges ports + itinerary + flights + lodging)
  const unifiedTimeline = buildUnifiedTimeline(tripData);

  return {
    ...tripData,
    unifiedTimeline,
    _config: {
      googleMapsApiKey: env.GOOGLE_MAPS_API_KEY,
      showMaps: tripMeta.showMaps !== false,
      showVideos: tripMeta.showVideos !== false,
      showTiers,
      showTravelStyle: tripMeta.showTravelStyle === true, // Hidden by default
      tripKey: tripKey,
      tripId,
      apiEndpoint: 'https://voygent.somotravel.workers.dev',
      commentThreadUrl,
      commentCount,
      commentCountLabel,
      hasComments,
      reserveUrl: tripMeta.reserveUrl || agentInfo.bookingUrl || '',
      agent: agentInfo
    }
  };
}

/**
 * Render trip data to HTML using the specified template
 * This is the main function used by preview_publish and publish_trip
 *
 * Template resolution:
 * 1. If templateName provided, look for it in: user templates → system templates
 * 2. If no templateName (or "default"), use userProfile.template as default first
 */
export async function renderTripHtml(
  env: Env,
  tripData: any,
  templateName: string | undefined,
  userProfile: UserProfile | null,
  tripKey: string,
  keyPrefix?: string
): Promise<string> {
  // Resolve which template to use (explicit request → trip meta → user default)
  const tripTemplate = tripData?.meta?.template || tripData?.template;
  const requestedTemplate = (templateName && templateName !== 'default')
    ? templateName
    : (tripTemplate && tripTemplate !== 'default' ? tripTemplate : undefined);
  const resolvedTemplate = resolveTemplateName(requestedTemplate, userProfile);

  // Get template HTML (checks user templates first, then system)
  const templateHtml = await getTemplateHtml(env, resolvedTemplate, keyPrefix);
  let commentCount = 0;
  try {
    const commentsData = await env.TRIPS.get(`${tripKey}/_comments`, 'json') as { comments: any[] } | null;
    commentCount = commentsData?.comments?.length || 0;
  } catch (err) {
    commentCount = 0;
  }
  const templateData = buildTemplateData(tripData, userProfile, env, tripKey, {
    commentCount,
    commentCountLabel: commentCount === 1 ? '1 comment' : `${commentCount} comments`,
    hasComments: commentCount > 0
  });
  let html = renderTemplate(templateHtml, templateData);

  // Add trial watermark if user is on trial tier
  if (userProfile?.subscription?.tier === 'trial') {
    html = injectTrialWatermark(html);
  }

  return html;
}

/**
 * Inject trial watermark into rendered HTML
 */
function injectTrialWatermark(html: string): string {
  const watermarkHtml = `
<style>
  .voygent-trial-watermark {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    text-align: center;
    padding: 10px 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 99999;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
  }
  .voygent-trial-watermark a {
    color: white;
    text-decoration: underline;
    font-weight: 600;
  }
</style>
<div class="voygent-trial-watermark">
  Created with Voygent (Trial) &middot; <a href="https://voygent.ai" target="_blank">Start your free trial at voygent.ai</a>
</div>
`;

  // Insert before </body>
  const bodyCloseIndex = html.toLowerCase().lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + watermarkHtml + html.slice(bodyCloseIndex);
  }

  // If no </body> found, append at the end
  return html + watermarkHtml;
}

/**
 * List available templates for a user
 * Returns both user-specific and system templates
 */
export async function listAvailableTemplates(
  env: Env,
  keyPrefix: string,
  listAllKeys: (env: Env, options: { prefix: string }) => Promise<{ name: string }[]>
): Promise<{ userTemplates: string[]; systemTemplates: string[]; defaultTemplate: string }> {
  // Get user's templates
  const userTemplateKeys = await listAllKeys(env, { prefix: `${keyPrefix}_templates/` });
  const userTemplates = userTemplateKeys
    .map(k => k.name.replace(`${keyPrefix}_templates/`, ""))
    .filter(name => name && !name.startsWith("_"));

  // Get system templates
  const systemTemplateKeys = await listAllKeys(env, { prefix: "_templates/" });
  const systemTemplates = systemTemplateKeys
    .map(k => k.name.replace("_templates/", ""))
    .filter(name => name && !name.startsWith("_"));

  return {
    userTemplates,
    systemTemplates,
    defaultTemplate: systemTemplates.includes("default") ? "default" : systemTemplates[0] || "default"
  };
}
