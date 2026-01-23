/**
 * MCP Tool Handlers: Validation and analysis operations
 * Handles: validate_trip, import_quote, analyze_profitability, get_prompt
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';
import { stripEmpty } from '../../lib/utils';

/**
 * Template field definitions - fields that are rendered in templates
 * Used to warn about data that won't be displayed
 */
const TEMPLATE_SUPPORTED_FIELDS = {
  // Common fields (both templates)
  common: new Set([
    'meta', 'meta.tripId', 'meta.title', 'meta.clientName', 'meta.destination', 'meta.dates',
    'meta.phase', 'meta.status', 'meta.lastModified', 'meta.isSample',
    'travelers', 'travelers.count', 'travelers.names', 'travelers.details', 'travelers.notes',
    'travelers.details.name', 'travelers.details.firstName', 'travelers.details.lastInitial',
    'travelers.details.type', 'travelers.details.age', 'travelers.details.mobilityIssues',
    'travelers.details.mobility', 'travelers.details.documentsNeeded', 'travelers.details.docsComplete',
    'dates', 'dates.start', 'dates.end', 'dates.duration', 'dates.flexible', 'dates.notes',
    'budget', 'budget.perPerson', 'budget.total', 'budget.notes', 'budget.lineItems',
    'budget.lineItems.label', 'budget.lineItems.amount', 'budget.lineItems.notes',
    'flights', 'flights.outbound', 'flights.return', 'flights.intraTrip',
    'flights.outbound.date', 'flights.outbound.route', 'flights.outbound.airline', 'flights.outbound.notes',
    'flights.return.date', 'flights.return.route', 'flights.return.airline', 'flights.return.notes',
    'lodging', 'lodging.name', 'lodging.location', 'lodging.nights', 'lodging.rate', 'lodging.total',
    'lodging.map', 'lodging.notes', 'lodging.confirmed', 'lodging.status', 'lodging.url',
    'lodging.checkIn', 'lodging.checkOut', 'lodging.images', 'lodging.image', 'lodging.options',
    'itinerary', 'itinerary.day', 'itinerary.date', 'itinerary.title', 'itinerary.location',
    'itinerary.description', 'itinerary.activities', 'itinerary.meals', 'itinerary.map', 'itinerary.tips',
    'itinerary.highlights', 'itinerary.shopping', 'itinerary.videos', 'itinerary.images', 'itinerary.lodging',
    'itinerary.transport', 'itinerary.driving', 'itinerary.dining', 'itinerary.cruiseInfo',
    'itinerary.activities.time', 'itinerary.activities.name', 'itinerary.activities.description',
    'itinerary.activities.cost', 'itinerary.activities.duration', 'itinerary.activities.notes',
    'itinerary.activities.optional', 'itinerary.activities.url', 'itinerary.activities.image',
    'itinerary.activities.images', 'itinerary.activities.highlight', 'itinerary.activities.bookingRequired',
    'itinerary.activities.tour', 'itinerary.activities.forWho',
    'tours', 'tours.name', 'tours.day', 'tours.duration', 'tours.includes', 'tours.price',
    'tiers', 'tiers.value', 'tiers.premium', 'tiers.luxury', 'tiers.notes',
    'tiers.value.name', 'tiers.value.description', 'tiers.value.includes', 'tiers.value.perPerson', 'tiers.value.estimatedTotal',
    'tiers.premium.name', 'tiers.premium.description', 'tiers.premium.includes', 'tiers.premium.perPerson', 'tiers.premium.estimatedTotal', 'tiers.premium.recommended',
    'tiers.luxury.name', 'tiers.luxury.description', 'tiers.luxury.includes', 'tiers.luxury.perPerson', 'tiers.luxury.estimatedTotal',
    'notes', 'maps', 'media', 'images', 'heroImage', 'featuredLinks', 'preferences',
    'preferences.vibe', 'preferences.mustHave', 'preferences.avoid',
    'extras', 'extras.hiddenGem', 'extras.waterFeaturePhotoOp',
    // New sections
    'hiddenGems', 'hiddenGems.name', 'hiddenGems.location', 'hiddenGems.description', 'hiddenGems.tip', 'hiddenGems.url',
    'localCustoms', 'localCustoms.title', 'localCustoms.description', 'localCustoms.doThis', 'localCustoms.avoidThis', 'localCustoms.port',
    'freeActivities', 'freeActivities.name', 'freeActivities.location', 'freeActivities.description', 'freeActivities.bestTime', 'freeActivities.onboard',
    'packingTips', 'packingTips.essentials', 'packingTips.recommended', 'packingTips.skip', 'packingTips.weather',
  ]),
  // Cruise-specific fields
  cruise: new Set([
    'cruiseInfo', 'cruiseInfo.cruiseLine', 'cruiseInfo.shipName', 'cruiseInfo.cabin',
    'cruiseInfo.cabin.type', 'cruiseInfo.cabin.category', 'cruiseInfo.cabin.notes', 'cruiseInfo.cabin.images',
    'cruiseInfo.embarkation', 'cruiseInfo.debarkation',
    'cruiseInfo.embarkation.port', 'cruiseInfo.embarkation.date', 'cruiseInfo.embarkation.time', 'cruiseInfo.embarkation.tips',
    'cruiseInfo.debarkation.port', 'cruiseInfo.debarkation.date', 'cruiseInfo.debarkation.time', 'cruiseInfo.debarkation.tips',
    'itinerary.type', 'itinerary.portInfo',
    'itinerary.portInfo.arrive', 'itinerary.portInfo.depart', 'itinerary.portInfo.allAboard',
    'itinerary.portInfo.dockOrTender', 'itinerary.portInfo.walkable', 'itinerary.portInfo.tenderNote',
    'itinerary.seaDayTips', 'itinerary.crowdAvoidance',
    'itinerary.activities.forWho', 'itinerary.activities.familyFriendly', 'itinerary.activities.avoidCrowdsTip',
    'itinerary.activities.crowdLevel',
    // Cruise-specific packing tips
    'packingTips.formalNights', 'packingTips.portDays',
  ]),
};

/**
 * Extract all field paths from an object recursively
 */
function extractFieldPaths(obj: any, prefix: string = ''): string[] {
  const paths: string[] = [];

  if (obj === null || obj === undefined) return paths;

  if (Array.isArray(obj)) {
    // For arrays, extract paths from the first element (sample structure)
    if (obj.length > 0 && typeof obj[0] === 'object') {
      const arrayPaths = extractFieldPaths(obj[0], prefix);
      paths.push(...arrayPaths);
    }
    paths.push(prefix.replace(/\.$/, '')); // Add the array field itself
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      if (key.startsWith('_')) continue; // Skip internal fields
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      paths.push(newPrefix);
      paths.push(...extractFieldPaths(obj[key], newPrefix));
    }
  }

  return paths;
}

/**
 * Check which fields in the trip data are NOT supported by templates
 */
function checkTemplateCoverage(tripData: any): {
  unsupportedFields: string[];
  unusedRecommendedFields: string[];
  isCruise: boolean;
} {
  const isCruise = !!tripData.cruiseInfo;
  const supportedFields = new Set([
    ...TEMPLATE_SUPPORTED_FIELDS.common,
    ...(isCruise ? TEMPLATE_SUPPORTED_FIELDS.cruise : [])
  ]);

  // Extract all paths from trip data
  const tripPaths = extractFieldPaths(tripData);
  const uniquePaths = [...new Set(tripPaths)];

  // Find unsupported fields (in trip data but not in template)
  const unsupportedFields: string[] = [];
  for (const path of uniquePaths) {
    // Check if any parent path is supported (e.g., if "meta" is supported, "meta.clientName" is too)
    const pathParts = path.split('.');
    let isSupported = false;

    // Check exact match first
    if (supportedFields.has(path)) {
      isSupported = true;
    } else {
      // Check if it's a nested field under a supported array field
      for (let i = pathParts.length - 1; i >= 0; i--) {
        const parentPath = pathParts.slice(0, i + 1).join('.');
        if (supportedFields.has(parentPath)) {
          isSupported = true;
          break;
        }
      }
    }

    if (!isSupported) {
      unsupportedFields.push(path);
    }
  }

  // Find recommended fields not being used
  const recommendedFields = [
    'hiddenGems', 'localCustoms', 'freeActivities', 'packingTips', 'tiers',
    ...(isCruise ? ['cruiseInfo', 'itinerary.portInfo'] : ['lodging', 'flights']),
  ];

  const unusedRecommendedFields = recommendedFields.filter(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], tripData);
    return value === undefined || value === null ||
           (Array.isArray(value) && value.length === 0) ||
           (typeof value === 'object' && Object.keys(value).length === 0);
  });

  return {
    unsupportedFields,
    unusedRecommendedFields,
    isCruise
  };
}

export const handleValidateTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId } = args;

  // Read trip data
  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json") as any;
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  // Check template coverage
  const templateCoverage = checkTemplateCoverage(tripData);

  // Load instruction from KV or use simple fallback
  let instruction = await env.TRIPS.get("_prompts/validate-trip", "text");
  if (!instruction) {
    instruction = "Analyze this trip for logistics issues, missing information, and data quality. Report Critical Issues, Warnings, Suggestions, and Trip Strengths.";
  }

  // Add template coverage warnings to instruction
  if (templateCoverage.unsupportedFields.length > 0) {
    instruction += `\n\n**⚠️ TEMPLATE COVERAGE WARNING:**\nThe following fields in the trip data will NOT be displayed in the published proposal because the template doesn't support them:\n- ${templateCoverage.unsupportedFields.join('\n- ')}\n\nConsider: Either remove these fields, or store this data in a supported field (like 'notes' or within itinerary activities).`;
  }

  if (templateCoverage.unusedRecommendedFields.length > 0) {
    instruction += `\n\n**💡 ENHANCEMENT OPPORTUNITY:**\nThe ${templateCoverage.isCruise ? 'cruise' : 'default'} template supports these fields that this trip doesn't use:\n- ${templateCoverage.unusedRecommendedFields.join('\n- ')}\n\nAdding these would make the published proposal more complete.`;
  }

  const result = {
    tripId,
    tripData,
    templateCoverage: {
      templateType: templateCoverage.isCruise ? 'cruise' : 'default',
      unsupportedFields: templateCoverage.unsupportedFields.length > 0 ? templateCoverage.unsupportedFields : undefined,
      unusedRecommendedFields: templateCoverage.unusedRecommendedFields.length > 0 ? templateCoverage.unusedRecommendedFields : undefined,
      status: templateCoverage.unsupportedFields.length === 0 ? 'All data will be displayed' : 'Some data will NOT be shown in published proposal'
    },
    _instruction: instruction
  };

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

export const handleImportQuote: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, quoteText, quoteType = "auto-detect" } = args;

  // Read trip data
  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json");
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  // Load instruction from KV or use simple fallback
  let instruction = await env.TRIPS.get("_prompts/import-quote", "text");
  if (!instruction) {
    instruction = "Parse this booking quote/confirmation and update the trip data. Extract key details, update the trip using patch_trip or save_trip, and report what was imported.\n\nQuote to parse:\n```\n{{quoteText}}\n```";
  }
  // Replace placeholders in instruction
  instruction = instruction.replace(/\{\{quoteText\}\}/g, quoteText);
  instruction = instruction.replace(/\{\{quoteType\}\}/g, quoteType);

  const result = {
    tripId,
    tripData,
    quoteText,
    quoteType,
    _instruction: instruction
  };

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

export const handleAnalyzeProfitability: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, targetCommission } = args;

  // Read trip data
  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json");
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  // Load instruction from KV or use simple fallback
  let instruction = await env.TRIPS.get("_prompts/analyze-profitability", "text");
  if (!instruction) {
    instruction = "Estimate agent commissions for this trip using standard industry rates. Provide a commission breakdown table, identify low-commission items, and suggest upsell opportunities.";
  }

  // Add target commission info if provided
  if (targetCommission) {
    instruction += `\n\n**Target Commission: $${targetCommission}**\nCalculate gap and provide specific recommendations to reach the target.`;
  }

  const result = {
    tripId,
    tripData,
    targetCommission: targetCommission || null,
    _instruction: instruction
  };

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

/**
 * Knowledge base item structure (for approved solutions)
 */
interface ApprovedKnowledge {
  id: string;
  problem: string;
  solution: string;
  context?: string;
  keywords: string[];
  approvedAt: string;
}

/**
 * Extract keywords from text for matching
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'for', 'on', 'with',
    'and', 'or', 'but', 'not', 'it', 'this', 'that', 'be', 'have', 'has', 'had', 'do'
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

export const handleGetPrompt: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { name: promptName, context: queryContext } = args;

  // Load the requested prompt from KV
  const promptKey = `_prompts/${promptName}`;
  let promptContent = await env.TRIPS.get(promptKey, "text");

  if (!promptContent) {
    throw new Error(`Prompt '${promptName}' not found. Available prompts: system-prompt, validate-trip, import-quote, analyze-profitability, cruise-instructions, handle-changes, flight-search, research-destination, trip-schema, admin-system-prompt, troubleshooting, faq`);
  }

  // For troubleshooting/faq prompts, append approved community knowledge
  if (promptName === 'troubleshooting' || promptName === 'faq') {
    const approvedData = await env.TRIPS.get(`_knowledge/approved/${promptName}`, 'json') as { items: ApprovedKnowledge[] } | null;

    if (approvedData?.items?.length) {
      let items = approvedData.items;

      // If context provided, filter to relevant items using keyword matching
      if (queryContext) {
        const contextKeywords = extractKeywords(queryContext);
        items = items.filter(item =>
          item.keywords.some(k => contextKeywords.includes(k))
        ).slice(0, 10); // Max 10 relevant items
      } else {
        // Default: most recent 20
        items = items.slice(0, 20);
      }

      if (items.length > 0) {
        promptContent += '\n\n---\n\n## Community Solutions\n\n';
        promptContent += '_The following solutions were contributed by users and approved by admins. If they conflict with the guidance above, the official guidance takes precedence._\n\n';

        for (const item of items) {
          promptContent += `### ${item.problem}\n`;
          promptContent += `${item.solution}\n\n`;
        }
      }
    }
  }

  const result = {
    promptName,
    content: promptContent,
    _note: "Use this guidance for the current task. The instructions above are specialized for this scenario."
  };

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

/**
 * Smart, context-aware trip checklist
 * Proactively identifies what's missing based on trip context
 */
interface ChecklistItem {
  category: string;
  issue: string;
  severity: 'missing' | 'warning' | 'suggestion';
  urgent?: boolean;
}

function calculateDaysBetween(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function daysUntilDeparture(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  return Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function hasChildren(travelers: any): boolean {
  if (!travelers?.details || !Array.isArray(travelers.details)) return false;
  return travelers.details.some((t: any) =>
    t.type === 'child' || t.type === 'infant' || (t.age && t.age < 18)
  );
}

function getTravelerCount(travelers: any): number {
  if (travelers?.count) return travelers.count;
  if (travelers?.details?.length) return travelers.details.length;
  return 0;
}

export const handleTripChecklist: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const tripId = args.tripId || args.key;
  const preset = args.preset || 'client_review';

  if (!tripId || typeof tripId !== 'string') {
    throw new Error("Missing required parameter 'tripId'");
  }

  const fullKey = keyPrefix + tripId;
  const trip = await env.TRIPS.get(fullKey, "json") as any;
  if (!trip) throw new Error(`Trip '${tripId}' not found.`);

  const issues: ChecklistItem[] = [];
  const complete: string[] = [];

  const isCruise = !!trip.cruiseInfo;
  const travelerCount = getTravelerCount(trip.travelers);
  const hasKids = hasChildren(trip.travelers);
  const daysUntil = trip.dates?.start ? daysUntilDeparture(trip.dates.start) : null;
  const tripDuration = (trip.dates?.start && trip.dates?.end)
    ? calculateDaysBetween(trip.dates.start, trip.dates.end)
    : null;

  // ============ BASIC STRUCTURE ============
  if (!trip.meta?.title) {
    issues.push({ category: 'basics', issue: 'Trip title not set', severity: 'missing' });
  } else {
    complete.push('Trip title');
  }

  if (!trip.meta?.destination) {
    issues.push({ category: 'basics', issue: 'Destination not specified', severity: 'missing' });
  } else {
    complete.push('Destination');
  }

  if (!trip.meta?.clientName) {
    issues.push({ category: 'basics', issue: 'Client name not set', severity: 'warning' });
  } else {
    complete.push('Client name');
  }

  // ============ DATES ============
  if (!trip.dates?.start) {
    issues.push({ category: 'dates', issue: 'Start date not set', severity: 'missing' });
  } else {
    complete.push('Start date');
  }

  if (!trip.dates?.end) {
    issues.push({ category: 'dates', issue: 'End date not set', severity: 'missing' });
  } else {
    complete.push('End date');
  }

  // ============ TRAVELERS ============
  if (travelerCount === 0) {
    issues.push({ category: 'travelers', issue: 'No travelers specified', severity: 'missing' });
  } else {
    complete.push(`${travelerCount} traveler(s)`);

    // Check if we have details for all travelers
    if (trip.travelers?.details?.length !== travelerCount && travelerCount > 0) {
      issues.push({
        category: 'travelers',
        issue: `Traveler details incomplete (have ${trip.travelers?.details?.length || 0} of ${travelerCount})`,
        severity: 'warning'
      });
    }
  }

  // ============ ITINERARY COVERAGE ============
  const itineraryDays = Array.isArray(trip.itinerary) ? trip.itinerary.length : 0;

  if (itineraryDays === 0) {
    issues.push({ category: 'itinerary', issue: 'No itinerary days created', severity: 'missing' });
  } else if (tripDuration && itineraryDays < tripDuration) {
    const missing = tripDuration - itineraryDays;
    issues.push({
      category: 'itinerary',
      issue: `Itinerary incomplete: ${missing} day(s) missing (have ${itineraryDays} of ${tripDuration})`,
      severity: 'warning'
    });
  } else {
    complete.push(`Itinerary (${itineraryDays} days)`);
  }

  // Check for empty itinerary days
  if (Array.isArray(trip.itinerary)) {
    trip.itinerary.forEach((day: any, idx: number) => {
      const dayNum = day.day || idx + 1;
      if (!day.activities || day.activities.length === 0) {
        issues.push({
          category: 'itinerary',
          issue: `Day ${dayNum} has no activities`,
          severity: 'suggestion'
        });
      }
    });
  }

  // ============ LODGING ============
  if (isCruise) {
    // Cruise - check cabin info
    if (!trip.cruiseInfo?.cabin) {
      issues.push({ category: 'lodging', issue: 'Cabin details not specified', severity: 'warning' });
    } else {
      complete.push('Cabin info');
    }
  } else {
    // Non-cruise - check lodging
    const lodgingCount = Array.isArray(trip.lodging) ? trip.lodging.length : 0;
    if (lodgingCount === 0) {
      issues.push({ category: 'lodging', issue: 'No lodging specified', severity: 'missing' });
    } else {
      complete.push(`Lodging (${lodgingCount} properties)`);

      // Check room/traveler ratio
      if (travelerCount > 0) {
        const totalRooms = trip.lodging.reduce((sum: number, l: any) => sum + (l.rooms || 1), 0);
        if (travelerCount > totalRooms * 4) {
          issues.push({
            category: 'lodging',
            issue: `Room capacity may be insufficient (${totalRooms} room(s) for ${travelerCount} travelers)`,
            severity: 'warning'
          });
        }
      }

      // Check lodging coverage
      if (tripDuration) {
        const totalNights = trip.lodging.reduce((sum: number, l: any) => sum + (l.nights || 0), 0);
        if (totalNights > 0 && totalNights < tripDuration - 1) {
          issues.push({
            category: 'lodging',
            issue: `Lodging nights don't cover full trip (${totalNights} nights for ${tripDuration - 1} night trip)`,
            severity: 'warning'
          });
        }
      }
    }
  }

  // ============ CRUISE-SPECIFIC ============
  if (isCruise) {
    if (!trip.cruiseInfo?.shipName) {
      issues.push({ category: 'cruise', issue: 'Ship name not specified', severity: 'warning' });
    }
    if (!trip.cruiseInfo?.embarkation?.port) {
      issues.push({ category: 'cruise', issue: 'Embarkation port not set', severity: 'missing' });
    }
    if (!trip.cruiseInfo?.debarkation?.port) {
      issues.push({ category: 'cruise', issue: 'Debarkation port not set', severity: 'missing' });
    }

    // Check port days have activities
    if (Array.isArray(trip.itinerary)) {
      trip.itinerary.forEach((day: any) => {
        if (day.type === 'port' && day.location && (!day.activities || day.activities.length === 0)) {
          issues.push({
            category: 'cruise',
            issue: `No shore excursions planned for ${day.location}`,
            severity: 'suggestion'
          });
        }
      });
    }
  }

  // ============ FLIGHTS ============
  if (!isCruise) {
    const hasOutbound = trip.flights?.outbound?.route || trip.flights?.outbound?.airline;
    const hasReturn = trip.flights?.return?.route || trip.flights?.return?.airline;

    if (!hasOutbound && !hasReturn) {
      issues.push({ category: 'flights', issue: 'No flights specified', severity: 'warning' });
    } else {
      if (!hasOutbound) {
        issues.push({ category: 'flights', issue: 'Outbound flight not set', severity: 'warning' });
      }
      if (!hasReturn) {
        issues.push({ category: 'flights', issue: 'Return flight not set', severity: 'warning' });
      }
      if (hasOutbound && hasReturn) {
        complete.push('Flights');
      }
    }
  }

  // ============ BUDGET ============
  if (!trip.budget?.total && !trip.budget?.perPerson && !trip.tiers) {
    issues.push({ category: 'budget', issue: 'No pricing/budget information', severity: 'warning' });
  } else {
    complete.push('Budget/pricing');
  }

  // ============ FAMILY-SPECIFIC ============
  if (hasKids) {
    // Check if any activities are marked family-friendly
    let hasFamilyActivities = false;
    if (Array.isArray(trip.itinerary)) {
      for (const day of trip.itinerary) {
        if (Array.isArray(day.activities)) {
          if (day.activities.some((a: any) => a.familyFriendly || a.forWho?.includes('kid') || a.forWho?.includes('family'))) {
            hasFamilyActivities = true;
            break;
          }
        }
      }
    }
    if (!hasFamilyActivities) {
      issues.push({
        category: 'family',
        issue: 'Trip includes children but no activities marked as family-friendly',
        severity: 'suggestion'
      });
    }
  }

  // ============ URGENCY CHECKS ============
  if (daysUntil !== null && daysUntil >= 0) {
    if (daysUntil <= 14) {
      // Urgent checks
      const missingCritical = issues.filter(i => i.severity === 'missing');
      if (missingCritical.length > 0) {
        issues.forEach(i => {
          if (i.severity === 'missing') i.urgent = true;
        });
      }

      if (!isCruise && !trip.flights?.outbound?.route) {
        issues.push({
          category: 'urgent',
          issue: `Departure in ${daysUntil} days - flights not confirmed`,
          severity: 'warning',
          urgent: true
        });
      }
    }

    if (daysUntil <= 7 && preset === 'pre_departure') {
      // Check for confirmation numbers
      if (!trip.bookings || Object.keys(trip.bookings).length === 0) {
        issues.push({
          category: 'urgent',
          issue: 'No booking confirmation numbers recorded',
          severity: 'warning',
          urgent: true
        });
      }
    }
  }

  // ============ PRESET-SPECIFIC CHECKS ============
  if (preset === 'ready_to_publish' || preset === 'client_review') {
    if (!trip.heroImage && (!trip.images || trip.images.length === 0)) {
      issues.push({
        category: 'presentation',
        issue: 'No images for published page',
        severity: 'suggestion'
      });
    }
  }

  if (preset === 'pre_departure') {
    // Document checks
    if (trip.travelers?.details) {
      const needsDocs = trip.travelers.details.filter((t: any) => !t.docsComplete);
      if (needsDocs.length > 0) {
        issues.push({
          category: 'documents',
          issue: `${needsDocs.length} traveler(s) without confirmed documents`,
          severity: 'warning',
          urgent: daysUntil !== null && daysUntil <= 14
        });
      }
    }
  }

  // ============ BUILD RESPONSE ============
  const urgent = issues.filter(i => i.urgent);
  const missing = issues.filter(i => i.severity === 'missing' && !i.urgent);
  const warnings = issues.filter(i => i.severity === 'warning' && !i.urgent);
  const suggestions = issues.filter(i => i.severity === 'suggestion');

  const readyForPreset = missing.length === 0 && urgent.length === 0;

  const result = {
    tripId,
    preset,
    ready: readyForPreset,
    summary: readyForPreset
      ? `✓ Ready for ${preset.replace(/_/g, ' ')}`
      : `${missing.length + urgent.length} issue(s) to resolve`,
    ...(daysUntil !== null && daysUntil >= 0 && { daysUntilDeparture: daysUntil }),
    ...(urgent.length > 0 && { urgent: urgent.map(i => i.issue) }),
    ...(missing.length > 0 && { missing: missing.map(i => i.issue) }),
    ...(warnings.length > 0 && { warnings: warnings.map(i => i.issue) }),
    ...(suggestions.length > 0 && { suggestions: suggestions.map(i => i.issue) }),
    complete
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};
