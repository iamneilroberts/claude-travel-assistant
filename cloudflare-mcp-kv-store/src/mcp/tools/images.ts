/**
 * MCP Tool Handlers: Image operations
 * Handles: add_trip_image, prepare_image_upload
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';

const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';

export const handleAddTripImage: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, imageUrl, target, itemName, caption } = args;

  if (!imageUrl) {
    throw new Error("imageUrl is required. Use prepare_image_upload to get an upload link first, then use the returned imageUrl here. Base64 image data is NOT supported.");
  }

  // Use the provided image URL (from prepare_image_upload)
  const category = target === "day" ? "itinerary" : target;
  const uploadResult = {
    urls: {
      original: imageUrl,
      large: `${imageUrl}?w=1600`,
      medium: `${imageUrl}?w=800`,
      thumbnail: `${imageUrl}?w=200`
    },
    key: imageUrl.replace(`${WORKER_BASE_URL}/media/`, '')
  };

  // Load the trip data
  const tripKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(tripKey, "json") as any;
  if (!tripData) {
    throw new Error(`Trip '${tripId}' not found`);
  }

  // Initialize images structure if needed
  if (!tripData.images) {
    tripData.images = { hero: [], lodging: {}, activities: {}, days: {} };
  }

  const imageEntry = {
    urls: uploadResult.urls,
    caption: caption || '',
    addedAt: new Date().toISOString()
  };

  // Helper to find best match for lodging/activity name
  // This handles cases where AI passes slightly different name than stored
  const findBestMatch = (searchName: string, items: any[]): string | null => {
    if (!items || !Array.isArray(items)) return null;

    // Normalize for comparison
    const normalize = (s: string) => s.toLowerCase()
      .replace(/^(the|hotel|resort|inn)\s+/i, '')
      .replace(/[^a-z0-9]/g, '');

    const searchNorm = normalize(searchName);

    // Try exact match first
    const exactMatch = items.find(i => i.name === searchName);
    if (exactMatch) return exactMatch.name;

    // Try case-insensitive match
    const caseMatch = items.find(i => i.name?.toLowerCase() === searchName.toLowerCase());
    if (caseMatch) return caseMatch.name;

    // Try normalized match
    const normMatch = items.find(i => normalize(i.name || '') === searchNorm);
    if (normMatch) return normMatch.name;

    // Try contains match (for partial names)
    const containsMatch = items.find(i =>
      normalize(i.name || '').includes(searchNorm) ||
      searchNorm.includes(normalize(i.name || ''))
    );
    if (containsMatch) return containsMatch.name;

    return null;
  };

  // Add image to appropriate location
  let actualItemName = itemName;

  if (target === "hero") {
    tripData.images.hero.push(imageEntry);
    // Set heroImage field for easy template access (uses latest hero image)
    tripData.heroImage = uploadResult.urls.large;
  } else if (target === "lodging") {
    if (!itemName) throw new Error("itemName required for lodging images (hotel name)");

    // Find the actual lodging name from trip data
    const matchedName = findBestMatch(itemName, tripData.lodging);
    if (matchedName) {
      actualItemName = matchedName;
    } else if (!tripData.lodging || !Array.isArray(tripData.lodging) || tripData.lodging.length === 0) {
      throw new Error(`Cannot attach lodging image: no lodging data found in trip. Add lodging first, then attach images.`);
    } else {
      // No match found - list available lodging to help debugging
      const availableNames = tripData.lodging.map((l: any) => l.name).filter(Boolean).join(', ');
      throw new Error(`Lodging '${itemName}' not found in trip. Available lodging: ${availableNames || '(none with names)'}`);
    }

    // Store in images object (legacy)
    if (!tripData.images.lodging[actualItemName]) tripData.images.lodging[actualItemName] = [];
    tripData.images.lodging[actualItemName].push(imageEntry);

    // Also store directly on the lodging item for template rendering
    const lodgingItem = tripData.lodging.find((l: any) => l.name === actualItemName);
    if (lodgingItem) {
      if (!lodgingItem.images) lodgingItem.images = [];
      lodgingItem.images.push(imageEntry);
    }
  } else if (target === "activity") {
    if (!itemName) throw new Error("itemName required for activity images (activity name)");

    // Find the actual activity name from trip data
    const allActivities = tripData.itinerary?.flatMap((day: any) => day.activities || []) || [];
    const matchedName = findBestMatch(itemName, allActivities);
    if (matchedName) {
      actualItemName = matchedName;
    } else if (allActivities.length === 0) {
      throw new Error(`Cannot attach activity image: no activities found in trip. Add itinerary first, then attach images.`);
    } else {
      // No match found - list available activities to help debugging
      const availableNames = allActivities.map((a: any) => a.name).filter(Boolean).slice(0, 10).join(', ');
      throw new Error(`Activity '${itemName}' not found in trip. Available activities: ${availableNames || '(none with names)'}${allActivities.length > 10 ? '...' : ''}`);
    }

    // Store in images object (legacy)
    if (!tripData.images.activities[actualItemName]) tripData.images.activities[actualItemName] = [];
    tripData.images.activities[actualItemName].push(imageEntry);

    // Also store directly on the activity for template rendering
    if (tripData.itinerary && Array.isArray(tripData.itinerary)) {
      for (const day of tripData.itinerary) {
        if (day.activities && Array.isArray(day.activities)) {
          const activity = day.activities.find((a: any) => a.name === actualItemName);
          if (activity) {
            if (!activity.images) activity.images = [];
            activity.images.push(imageEntry);
            break;
          }
        }
      }
    }
  } else if (target === "day") {
    if (!itemName) throw new Error("itemName required for day images (day number)");

    // Store in images object (legacy)
    if (!tripData.images.days[itemName]) tripData.images.days[itemName] = [];
    tripData.images.days[itemName].push(imageEntry);

    // Also store directly on the day for template rendering
    const dayNum = parseInt(itemName, 10);
    if (tripData.itinerary && Array.isArray(tripData.itinerary)) {
      const dayItem = tripData.itinerary.find((d: any) => d.day === dayNum || d.day === itemName);
      if (dayItem) {
        if (!dayItem.images) dayItem.images = [];
        dayItem.images.push(imageEntry);
      }
    }
  } else if (target === "cabin") {
    // Cabin images for cruise trips - store on cruiseInfo.cabin
    if (!tripData.images.cabin) tripData.images.cabin = [];
    tripData.images.cabin.push(imageEntry);

    // Also store directly on cruiseInfo.cabin for template rendering
    // Initialize cruiseInfo if it doesn't exist so cabin images are always accessible
    if (!tripData.cruiseInfo) tripData.cruiseInfo = {};
    if (!tripData.cruiseInfo.cabin) tripData.cruiseInfo.cabin = {};
    if (!tripData.cruiseInfo.cabin.images) tripData.cruiseInfo.cabin.images = [];
    tripData.cruiseInfo.cabin.images.push(imageEntry);
  }

  // Save updated trip
  await env.TRIPS.put(tripKey, JSON.stringify(tripData));

  const result = {
    success: true,
    target,
    itemName: actualItemName || null,
    requestedName: itemName !== actualItemName ? itemName : undefined,
    urls: uploadResult.urls,
    message: `✓ Image added to ${target}${actualItemName ? ` (${actualItemName})` : ''} for trip '${tripId}'.${itemName !== actualItemName ? ` (matched from '${itemName}')` : ''}`
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};

export const handlePrepareImageUpload: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, category, description } = args;

  if (!category) {
    throw new Error("category is required (hero, lodging, activity, or destination)");
  }

  // Generate a unique image ID
  const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Build the path where the image will be stored
  // Format: {tripId}/{category}/{imageId} or uploads/{category}/{imageId}
  const basePath = tripId ? `trips/${tripId}/${category}` : `uploads/${category}`;

  // Build upload URL with all parameters pre-set
  const uploadParams = new URLSearchParams({
    key: userProfile?.authKey || authKey,
    id: imageId,
    cat: category
  });
  if (tripId) uploadParams.set('trip', tripId);
  if (description) uploadParams.set('desc', description);

  const uploadUrl = `${WORKER_BASE_URL}/upload?${uploadParams.toString()}`;

  // The final image URL (extension will be determined by actual file type)
  // We'll use a placeholder extension that the upload page will correct
  const imageUrlBase = `${WORKER_BASE_URL}/media/${basePath}/${imageId}`;

  const result = {
    uploadUrl,
    imageId,
    imageUrlBase,
    // Provide URLs for common extensions - the actual one will work after upload
    expectedUrls: {
      jpg: `${imageUrlBase}.jpg`,
      png: `${imageUrlBase}.png`
    },
    tripId: tripId || null,
    category,
    description: description || null,
    instructions: `Give the user this upload link. After they confirm upload is complete, the image will be available. You can then add it to the trip using add_trip_image or include the URL directly.`
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};
