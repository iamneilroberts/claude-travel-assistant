/**
 * Media endpoint (R2 storage for images)
 */

import type { Env, RouteHandler } from '../types';

export const handleMedia: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (!url.pathname.startsWith("/media/")) {
    return null;
  }

  const key = url.pathname.replace("/media/", "");
  const requestedWidth = url.searchParams.get("w");

  if (!key) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.MEDIA.get(key);

  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000"); // Cache for 1 year

  // TODO: Add actual image resizing when requestedWidth is provided
  // For now, return original image. Future: use Cloudflare Image Resizing or WASM library
  // Supported sizes: 200 (thumbnail), 800 (medium), 1600 (large)
  if (requestedWidth) {
    headers.set("X-Requested-Width", requestedWidth);
    // When resizing is implemented, smaller images will have shorter cache
    // headers.set("Cache-Control", "public, max-age=604800"); // 1 week for resized
  }

  return new Response(object.body, { headers });
};
