/**
 * Gallery page endpoint (requires auth)
 */

import type { Env, UserProfile, RouteHandler } from '../types';
import { getValidAuthKeys } from '../lib/auth';
import { getGalleryPageHtml, GalleryImage } from '../gallery-page';

const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';

export const handleGallery: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/gallery") {
    return null;
  }

  // Validate auth key
  const authKey = url.searchParams.get("key");
  if (!authKey) {
    return new Response("Unauthorized - key required in URL", { status: 401 });
  }

  // Validate auth key against env vars or KV users
  const validKeys = await getValidAuthKeys(env);
  let isValid = validKeys.includes(authKey);

  if (!isValid) {
    const [name, code] = authKey.split('.');
    if (name && code) {
      const userId = name.toLowerCase() + "_" + code.toLowerCase();
      const userKey = "_users/" + userId;
      const userData = await env.TRIPS.get(userKey, "json") as UserProfile | null;
      if (userData && userData.authKey === authKey) {
        isValid = true;
      }
    }
  }

  if (!isValid) {
    return new Response("Unauthorized - invalid key", { status: 401 });
  }

  const tripId = url.searchParams.get("trip") || undefined;

  // List images from R2
  const images: GalleryImage[] = [];
  const listOptions: R2ListOptions = tripId
    ? { prefix: `trips/${tripId}/` }
    : { limit: 500 };

  const listed = await env.MEDIA.list(listOptions);

  for (const object of listed.objects) {
    // Skip non-image files
    if (!object.key.match(/\.(jpg|jpeg|png|gif|webp)$/i)) continue;

    // Get metadata
    const meta = object.customMetadata || {};

    images.push({
      key: object.key,
      url: `${WORKER_BASE_URL}/media/${object.key}`,
      category: meta.category || object.key.split('/')[0] || 'uploads',
      uploaded: meta.uploaded || object.uploaded.toISOString(),
      size: object.size
    });
  }

  // Sort by upload date, newest first
  images.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime());

  return new Response(getGalleryPageHtml({ authKey, tripId, images }), {
    headers: { "Content-Type": "text/html" }
  });
};
