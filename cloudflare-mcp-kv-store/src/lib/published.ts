/**
 * Published trip storage using R2 for HTML content and KV for metadata
 */

import type { Env } from '../types';

/**
 * Metadata for a published trip
 */
export interface PublishedTripMetadata {
  tripId: string;
  filename: string;
  title: string;
  destination?: string;
  category: string;
  publishedAt: string;
  lastModified: string;
  views?: number;
}

/**
 * Index of all published trips for a user
 */
export interface PublishedTripIndex {
  trips: PublishedTripMetadata[];
  lastUpdated: string;
}

/**
 * Save a published trip to R2 and update metadata in KV
 */
export async function savePublishedTrip(
  env: Env,
  userId: string,
  tripId: string,
  html: string,
  metadata: Omit<PublishedTripMetadata, 'tripId' | 'publishedAt' | 'lastModified'>
): Promise<string> {
  const now = new Date().toISOString();
  const filename = metadata.filename || `${tripId}.html`;

  // Save HTML to R2
  const r2Key = `published/${userId}/${filename}`;
  await env.MEDIA.put(r2Key, html, {
    httpMetadata: {
      contentType: 'text/html; charset=utf-8',
      cacheControl: 'public, max-age=300' // 5 minute cache
    },
    customMetadata: {
      tripId,
      userId,
      publishedAt: now
    }
  });

  // Update metadata in KV
  const tripMeta: PublishedTripMetadata = {
    tripId,
    filename,
    title: metadata.title,
    destination: metadata.destination,
    category: metadata.category,
    publishedAt: now,
    lastModified: now,
    views: 0
  };

  // Save individual trip metadata
  await env.TRIPS.put(
    `_published-meta/${userId}/${tripId}`,
    JSON.stringify(tripMeta)
  );

  // Update the index
  await updatePublishedIndex(env, userId, tripMeta);

  return filename;
}

/**
 * Get published trip HTML from R2
 */
export async function getPublishedTrip(
  env: Env,
  userId: string,
  filename: string
): Promise<string | null> {
  const r2Key = `published/${userId}/${filename}`;
  const object = await env.MEDIA.get(r2Key);

  if (!object) {
    return null;
  }

  return await object.text();
}

/**
 * Get published trip metadata from KV
 */
export async function getPublishedTripMetadata(
  env: Env,
  userId: string,
  tripId: string
): Promise<PublishedTripMetadata | null> {
  const data = await env.TRIPS.get(`_published-meta/${userId}/${tripId}`, 'json');
  return data as PublishedTripMetadata | null;
}

/**
 * List all published trips for a user
 */
export async function listPublishedTrips(
  env: Env,
  userId: string
): Promise<PublishedTripMetadata[]> {
  const indexKey = `_published-meta/${userId}/index`;
  const index = await env.TRIPS.get(indexKey, 'json') as PublishedTripIndex | null;

  if (!index) {
    // Rebuild index from individual metadata entries
    return await rebuildPublishedIndex(env, userId);
  }

  return index.trips;
}

/**
 * Delete a published trip
 */
export async function deletePublishedTrip(
  env: Env,
  userId: string,
  tripId: string
): Promise<void> {
  // Get metadata to find filename
  const metadata = await getPublishedTripMetadata(env, userId, tripId);

  if (metadata) {
    // Delete from R2
    const r2Key = `published/${userId}/${metadata.filename}`;
    await env.MEDIA.delete(r2Key);

    // Delete individual metadata
    await env.TRIPS.delete(`_published-meta/${userId}/${tripId}`);

    // Update index
    await removeFromPublishedIndex(env, userId, tripId);
  }
}

/**
 * Check if a trip is published
 */
export async function isPublished(
  env: Env,
  userId: string,
  tripId: string
): Promise<boolean> {
  const metadata = await getPublishedTripMetadata(env, userId, tripId);
  return metadata !== null;
}

/**
 * Update the published trips index
 */
async function updatePublishedIndex(
  env: Env,
  userId: string,
  tripMeta: PublishedTripMetadata
): Promise<void> {
  const indexKey = `_published-meta/${userId}/index`;
  const index = await env.TRIPS.get(indexKey, 'json') as PublishedTripIndex | null;

  const trips = index?.trips || [];

  // Remove existing entry for this trip if present
  const filteredTrips = trips.filter(t => t.tripId !== tripMeta.tripId);

  // Add new/updated entry
  filteredTrips.push(tripMeta);

  // Sort by lastModified descending
  filteredTrips.sort((a, b) =>
    new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  );

  const newIndex: PublishedTripIndex = {
    trips: filteredTrips,
    lastUpdated: new Date().toISOString()
  };

  await env.TRIPS.put(indexKey, JSON.stringify(newIndex));
}

/**
 * Remove a trip from the published index
 */
async function removeFromPublishedIndex(
  env: Env,
  userId: string,
  tripId: string
): Promise<void> {
  const indexKey = `_published-meta/${userId}/index`;
  const index = await env.TRIPS.get(indexKey, 'json') as PublishedTripIndex | null;

  if (!index) return;

  const filteredTrips = index.trips.filter(t => t.tripId !== tripId);

  const newIndex: PublishedTripIndex = {
    trips: filteredTrips,
    lastUpdated: new Date().toISOString()
  };

  await env.TRIPS.put(indexKey, JSON.stringify(newIndex));
}

/**
 * Rebuild the published index from individual metadata entries
 */
async function rebuildPublishedIndex(
  env: Env,
  userId: string
): Promise<PublishedTripMetadata[]> {
  const prefix = `_published-meta/${userId}/`;
  const keys = await env.TRIPS.list({ prefix });

  const trips: PublishedTripMetadata[] = [];

  for (const key of keys.keys) {
    // Skip the index key itself
    if (key.name.endsWith('/index')) continue;

    const metadata = await env.TRIPS.get(key.name, 'json') as PublishedTripMetadata | null;
    if (metadata) {
      trips.push(metadata);
    }
  }

  // Sort by lastModified descending
  trips.sort((a, b) =>
    new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  );

  // Save the rebuilt index
  const newIndex: PublishedTripIndex = {
    trips,
    lastUpdated: new Date().toISOString()
  };

  await env.TRIPS.put(`_published-meta/${userId}/index`, JSON.stringify(newIndex));

  return trips;
}

/**
 * Update view count for a published trip
 */
export async function incrementPublishedTripViews(
  env: Env,
  userId: string,
  tripId: string
): Promise<void> {
  const metaKey = `_published-meta/${userId}/${tripId}`;
  const metadata = await env.TRIPS.get(metaKey, 'json') as PublishedTripMetadata | null;

  if (metadata) {
    metadata.views = (metadata.views || 0) + 1;
    metadata.lastModified = new Date().toISOString();
    await env.TRIPS.put(metaKey, JSON.stringify(metadata));
  }
}

/**
 * Save a draft/preview trip to R2 (separate from published trips)
 * Drafts are stored in drafts/ subfolder and not indexed in the published list
 */
export async function saveDraftTrip(
  env: Env,
  userId: string,
  tripId: string,
  html: string
): Promise<string> {
  const filename = `${tripId}.html`;

  // Save HTML to R2 in drafts folder
  const r2Key = `drafts/${userId}/${filename}`;
  await env.MEDIA.put(r2Key, html, {
    httpMetadata: {
      contentType: 'text/html; charset=utf-8',
      cacheControl: 'public, max-age=60' // 1 minute cache for drafts
    },
    customMetadata: {
      tripId,
      userId,
      savedAt: new Date().toISOString(),
      isDraft: 'true'
    }
  });

  return filename;
}

/**
 * Get a draft trip HTML from R2
 */
export async function getDraftTrip(
  env: Env,
  userId: string,
  filename: string
): Promise<string | null> {
  const r2Key = `drafts/${userId}/${filename}`;
  const object = await env.MEDIA.get(r2Key);

  if (!object) {
    return null;
  }

  return await object.text();
}
