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
    'packingTips.formalNights', 'packingTips.portDays',
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

export const handleGetPrompt: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { name: promptName } = args;

  // Load the requested prompt from KV
  const promptKey = `_prompts/${promptName}`;
  const promptContent = await env.TRIPS.get(promptKey, "text");

  if (!promptContent) {
    throw new Error(`Prompt '${promptName}' not found. Available prompts: system-prompt, validate-trip, import-quote, analyze-profitability, cruise-instructions, handle-changes, flight-search, research-destination, trip-schema, admin-system-prompt`);
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
