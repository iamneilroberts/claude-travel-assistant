/**
 * Upload page endpoint (requires auth)
 */

import type { Env, UserProfile, RouteHandler } from '../types';
import { getValidAuthKeys } from '../lib/auth';
import { getKeyPrefix } from '../lib/kv';
import { getUploadPageHtml, UploadPageParams } from '../upload-page';

const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';

export const handleUpload: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/upload") {
    return null;
  }

  // Validate auth key for both GET and POST
  const authKey = url.searchParams.get("key");
  if (!authKey) {
    return new Response("Unauthorized - key required in URL", { status: 401 });
  }

  // Validate auth key against env vars or KV users
  const validKeys = await getValidAuthKeys(env);
  let isValid = validKeys.includes(authKey);
  let keyPrefix = "";

  if (isValid) {
    keyPrefix = getKeyPrefix(authKey);
  } else {
    // Check KV users
    const [name, code] = authKey.split('.');
    if (name && code) {
      const userId = name.toLowerCase() + "_" + code.toLowerCase();
      const userKey = "_users/" + userId;
      const userData = await env.TRIPS.get(userKey, "json") as UserProfile | null;
      if (userData && userData.authKey === authKey) {
        isValid = true;
        keyPrefix = userId + "/";
      }
    }
  }

  if (!isValid) {
    return new Response("Unauthorized - invalid key", { status: 401 });
  }

  // GET - serve upload page
  if (request.method === "GET") {
    // Parse optional preset params from URL
    const params: UploadPageParams = {
      authKey,
      imageId: url.searchParams.get("id") || undefined,
      tripId: url.searchParams.get("trip") || undefined,
      category: url.searchParams.get("cat") || undefined,
      description: url.searchParams.get("desc") || undefined
    };
    return new Response(getUploadPageHtml(params), {
      headers: { "Content-Type": "text/html" }
    });
  }

  // POST - handle file upload
  if (request.method === "POST") {
    try {
      const formData = await request.formData();
      const file = formData.get("image") as File | null;
      const category = (formData.get("category") as string) || "";
      const caption = (formData.get("caption") as string) || "";
      const presetImageId = (formData.get("imageId") as string) || "";
      const presetTripId = (formData.get("tripId") as string) || "";

      if (!file) {
        return new Response(JSON.stringify({ error: "No image provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const binaryData = new Uint8Array(arrayBuffer);

      // Check file size (10MB limit)
      if (binaryData.length > 10 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Image must be less than 10MB" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Detect image type from magic bytes
      let contentType = "image/jpeg";
      let extension = "jpg";

      if (binaryData[0] === 0xFF && binaryData[1] === 0xD8 && binaryData[2] === 0xFF) {
        contentType = "image/jpeg";
        extension = "jpg";
      } else if (binaryData[0] === 0x89 && binaryData[1] === 0x50 && binaryData[2] === 0x4E && binaryData[3] === 0x47) {
        contentType = "image/png";
        extension = "png";
      } else if (binaryData[0] === 0x47 && binaryData[1] === 0x49 && binaryData[2] === 0x46) {
        contentType = "image/gif";
        extension = "gif";
      } else if (binaryData[0] === 0x52 && binaryData[1] === 0x49 && binaryData[2] === 0x46 && binaryData[3] === 0x46) {
        contentType = "image/webp";
        extension = "webp";
      } else {
        return new Response(JSON.stringify({ error: "Unsupported image format. Use JPG, PNG, GIF, or WebP." }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Build filename - use preset ID if provided, otherwise generate
      let filename: string;
      if (presetImageId && presetTripId) {
        // Preset from prepare_image_upload: trips/{tripId}/{category}/{imageId}.{ext}
        filename = `trips/${presetTripId}/${category || 'uploads'}/${presetImageId}.${extension}`;
      } else if (presetImageId) {
        // Preset ID but no trip: uploads/{category}/{imageId}.{ext}
        filename = `uploads/${category || 'general'}/${presetImageId}.${extension}`;
      } else {
        // Generate new filename
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const folder = category || "uploads";
        filename = `${folder}/${timestamp}_${randomSuffix}.${extension}`;
      }

      // Store in R2 with metadata
      await env.MEDIA.put(filename, binaryData, {
        httpMetadata: { contentType },
        customMetadata: {
          category: category || 'uploads',
          tripId: presetTripId || '',
          caption: caption || '',
          uploaded: new Date().toISOString()
        }
      });

      const imageUrl = `${WORKER_BASE_URL}/media/${filename}`;

      return new Response(JSON.stringify({
        success: true,
        url: imageUrl,
        filename,
        contentType,
        size: binaryData.length,
        category: category || "uploads",
        tripId: presetTripId || null,
        caption
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      console.error("Upload error:", err);
      return new Response(JSON.stringify({ error: "Upload failed: " + (err as Error).message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};
