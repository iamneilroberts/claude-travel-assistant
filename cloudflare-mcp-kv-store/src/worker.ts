/**
 * Cloudflare Worker MCP Server (JSON-RPC 2.0 via SSE)
 * Implements a simple Key-Value store for JSON trip data.
 */

import { renderTemplate } from './simple-template';
import { DEFAULT_TEMPLATE } from './default-template';
import { getUploadPageHtml, UploadPageParams } from './upload-page';
import { getGalleryPageHtml, GalleryImage } from './gallery-page';
import { ADMIN_DASHBOARD_HTML } from './admin-dashboard';
import { getSubscribePageHtml, SUBSCRIBE_SUCCESS_HTML } from './subscribe-pages';
import { renderTripHtml } from './template-renderer';
import type { Env, UserProfile, MonthlyUsage, JsonRpcRequest, JsonRpcResponse } from './types';

// Base URLs
const WORKER_BASE_URL = 'https://voygent.somotravel.workers.dev';
const SITE_BASE_URL = 'https://somotravel.us';

// Stripe API helper (Cloudflare Workers can't use full Stripe SDK)
async function stripeRequest(
  env: Env,
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'POST',
  data?: Record<string, any>
): Promise<any> {
  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: data ? new URLSearchParams(flattenObject(data)).toString() : undefined
  });

  const result = await response.json() as any;
  if (!response.ok) {
    throw new Error(result.error?.message || `Stripe API error: ${response.status}`);
  }
  return result;
}

// Flatten nested objects for Stripe's form encoding (e.g., metadata[key] = value)
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && value !== undefined) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object') {
            Object.assign(result, flattenObject(item, `${newKey}[${index}]`));
          } else {
            result[`${newKey}[${index}]`] = String(item);
          }
        });
      } else {
        result[newKey] = String(value);
      }
    }
  }
  return result;
}

// Verify Stripe webhook signature
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const expectedSig = parts['v1'];

  if (!timestamp || !expectedSig) return false;

  // Check timestamp is within tolerance (5 minutes)
  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (timestampAge > 300) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computedSig = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSig === expectedSig;
}

// Get current month's usage for a user
async function getMonthlyUsage(env: Env, userId: string): Promise<MonthlyUsage> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const usageKey = `_usage/${userId}/${currentMonth}`;
  const usage = await env.TRIPS.get(usageKey, "json") as MonthlyUsage | null;
  return usage || {
    userId,
    period: currentMonth,
    publishCount: 0,
    publishedTrips: [],
    lastUpdated: new Date().toISOString()
  };
}

// Increment publish count for a user
async function incrementPublishCount(
  env: Env,
  userId: string,
  tripId: string,
  filename: string
): Promise<MonthlyUsage> {
  const usage = await getMonthlyUsage(env, userId);
  usage.publishCount++;
  usage.publishedTrips.push({
    tripId,
    publishedAt: new Date().toISOString(),
    filename
  });
  usage.lastUpdated = new Date().toISOString();

  const currentMonth = new Date().toISOString().slice(0, 7);
  await env.TRIPS.put(`_usage/${userId}/${currentMonth}`, JSON.stringify(usage));
  return usage;
}

// Stripe customer index helpers for O(1) lookups
async function setStripeCustomerIndex(env: Env, customerId: string, userId: string): Promise<void> {
  await env.TRIPS.put(`_stripe-customers/${customerId}`, userId);
}

async function getStripeCustomerIndex(env: Env, customerId: string): Promise<string | null> {
  return await env.TRIPS.get(`_stripe-customers/${customerId}`, "text");
}

// Auth key index helpers for O(1) lookups
async function setAuthKeyIndex(env: Env, authKey: string, userId: string): Promise<void> {
  await env.TRIPS.put(`_auth-index/${authKey}`, userId);
}

async function getAuthKeyIndex(env: Env, authKey: string): Promise<string | null> {
  return await env.TRIPS.get(`_auth-index/${authKey}`, "text");
}

// Helper to base64 encode strings for GitHub API
function toBase64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

// Find user by Stripe customer ID (uses index for O(1) lookup)
async function findUserByStripeCustomerId(env: Env, customerId: string): Promise<UserProfile | null> {
  // Try index first (O(1))
  const userId = await getStripeCustomerIndex(env, customerId);
  if (userId) {
    const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
    if (user) return user;
  }

  // Fallback to scan (O(n)) - for migration period
  const userKeys = await env.TRIPS.list({ prefix: "_users/" });
  for (const key of userKeys.keys) {
    const user = await env.TRIPS.get(key.name, "json") as UserProfile;
    if (user?.subscription?.stripeCustomerId === customerId) {
      // Backfill index for future lookups
      await setStripeCustomerIndex(env, customerId, user.userId);
      return user;
    }
  }
  return null;
}

// Generate setup email for new user
function generateSetupEmail(user: UserProfile): { subject: string; body: string } {
  const mcpUrl = `${WORKER_BASE_URL}/sse?key=${user.authKey}`;

  return {
    subject: `Welcome to Voygent - Your Travel Planning Assistant`,
    body: `Hi ${user.name},

Welcome to Voygent! Your travel planning assistant is ready to use.

== YOUR SETUP KEY ==
${user.authKey}

== SETUP INSTRUCTIONS ==

--- ChatGPT Setup ---
1. Go to ChatGPT Settings > Apps > Advanced settings > Create app
2. Fill in the form:
   - Name: Voygent
   - Description: Voygent AI powered travel assistant
   - MCP Server URL: ${mcpUrl}
   - Authentication: No Auth
3. Check "I understand and want to continue"
4. Click Create
5. Start a new conversation and say "use voygent, list trips"

--- Claude Desktop Setup ---
1. Open your Claude Desktop config file:
   - Mac: ~/Library/Application Support/Claude/claude_desktop_config.json
   - Windows: %APPDATA%/Claude/claude_desktop_config.json
   - Linux: ~/.config/Claude/claude_desktop_config.json

2. Add this to the "mcpServers" section:
{
  "voygent": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "${mcpUrl}"]
  }
}

3. Restart Claude Desktop

--- Claude.ai Web Setup (also configures iOS mobile app) ---
1. Go to Claude.ai Settings > Connectors
2. Click "Add custom connector"
3. Fill in the form:
   - Name: Voygent
   - Remote MCP server URL: ${mcpUrl}
4. Click Add
5. Start a new conversation

== QUICK COMMANDS ==
- "my trips" - List your trips
- "new trip" - Start planning
- "publish [trip]" - Publish to client
- "comments" - View client feedback

== SUPPORT ==
Questions? Reply to this email or contact support.

Happy planning!
The Voygent Team
`
  };
}

// Get key prefix for data isolation (sanitize key to safe string)
function getKeyPrefix(authKey: string): string {
  // Convert key to safe prefix: "Home.Star1" -> "home_star1/"
  return authKey.toLowerCase().replace(/[^a-z0-9]/g, '_') + '/';
}

// Comment index helpers for O(1) comment lookups
// Index stores trip IDs that have active (non-dismissed) comments
async function addToCommentIndex(env: Env, keyPrefix: string, tripId: string): Promise<void> {
  const indexKey = `${keyPrefix}_comment-index`;
  const existing = await env.TRIPS.get(indexKey, "json") as string[] | null;
  const index = new Set(existing || []);
  index.add(tripId);
  await env.TRIPS.put(indexKey, JSON.stringify([...index]));
}

async function removeFromCommentIndex(env: Env, keyPrefix: string, tripId: string): Promise<void> {
  const indexKey = `${keyPrefix}_comment-index`;
  const existing = await env.TRIPS.get(indexKey, "json") as string[] | null;
  if (!existing) return;
  const index = new Set(existing);
  index.delete(tripId);
  await env.TRIPS.put(indexKey, JSON.stringify([...index]));
}

async function getCommentIndex(env: Env, keyPrefix: string): Promise<string[]> {
  const indexKey = `${keyPrefix}_comment-index`;
  return await env.TRIPS.get(indexKey, "json") as string[] || [];
}

// Get valid auth keys (check KV first, then fall back to env var)
async function getValidAuthKeys(env: Env): Promise<string[]> {
  // First check KV for auth keys
  const kvKeys = await env.TRIPS.get("_config/auth-keys", "json") as string[] | null;
  if (kvKeys && kvKeys.length > 0) {
    return kvKeys;
  }
  // Fallback to env var during migration
  return env.AUTH_KEYS ? env.AUTH_KEYS.split(',').map(k => k.trim()) : [];
}


// CORS helper - restricts to known domains
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = [
    SITE_BASE_URL,
    "https://www.somotravel.us",
    "https://claude.ai",
    WORKER_BASE_URL,
    "http://localhost:3000",  // Local development
  ];

  // Use the request origin if it's in our allowed list, otherwise use default
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    "Access-Control-Allow-Credentials": "true",
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for public endpoints
    const corsHeaders = getCorsHeaders(request);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // PUBLIC ENDPOINT: Client comment submission (no auth required)
    if (url.pathname === "/comment" && request.method === "POST") {
      try {
        // Rate limit: 10 comments per IP per hour
        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
        const hourKey = new Date().toISOString().slice(0, 13); // "2026-01-13T14"
        const rateLimitKey = `_ratelimit/comment/${clientIP}/${hourKey}`;
        const currentCount = await env.TRIPS.get(rateLimitKey, "json") as number || 0;

        if (currentCount >= 10) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Increment rate limit counter (expires in 1 hour)
        await env.TRIPS.put(rateLimitKey, JSON.stringify(currentCount + 1), { expirationTtl: 3600 });

        const body = await request.json() as {
          tripKey: string;      // Full key path like "home_star1/caribbean-trip"
          section: string;      // "lodging", "itinerary", "general", etc.
          item?: string;        // Optional: specific item like "Day 3" or hotel name
          message: string;
          name?: string;
          email?: string;
        };

        if (!body.tripKey || !body.message) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Load existing comments
        const commentsKey = `${body.tripKey}/_comments`;
        const existing = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;
        const comments = existing?.comments || [];

        // Add new comment
        comments.push({
          id: crypto.randomUUID(),
          section: body.section,
          item: body.item || null,
          message: body.message,
          name: body.name || "Anonymous",
          email: body.email || null,
          timestamp: new Date().toISOString(),
          read: false
        });

        // Save
        await env.TRIPS.put(commentsKey, JSON.stringify({ comments }));

        // Update comment index for efficient lookups
        // tripKey format: "user_prefix/trip-id" - extract both parts
        const slashIndex = body.tripKey.indexOf('/');
        if (slashIndex > 0) {
          const keyPrefix = body.tripKey.substring(0, slashIndex + 1); // includes trailing /
          const tripId = body.tripKey.substring(slashIndex + 1);
          await addToCommentIndex(env, keyPrefix, tripId);
        }

        return new Response(JSON.stringify({ success: true, commentCount: comments.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: "Failed to save comment" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ========== MEDIA ENDPOINT (R2) ==========
    if (url.pathname.startsWith("/media/")) {
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
    }

    // ========== UPLOAD PAGE ENDPOINT ==========
    if (url.pathname === "/upload") {
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
    }

    // ========== GALLERY PAGE ENDPOINT ==========
    if (url.pathname === "/gallery") {
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
    }

    // ========== STRIPE SUBSCRIPTION ENDPOINTS ==========

    // POST /webhook/stripe - Handle Stripe webhook events
    if (url.pathname === "/webhook/stripe" && request.method === "POST") {
      const signature = request.headers.get("stripe-signature");
      if (!signature) {
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const payload = await request.text();

      // Verify webhook signature
      const isValid = await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const event = JSON.parse(payload);

      // Log event for audit
      await env.TRIPS.put(`_stripe_events/${event.id}`, JSON.stringify({
        type: event.type,
        timestamp: new Date().toISOString(),
        processed: false,
        data: event.data.object
      }));

      try {
        switch (event.type) {
          case 'customer.subscription.created':
          case 'customer.subscription.updated': {
            const subscription = event.data.object;
            const customerId = subscription.customer;
            const user = await findUserByStripeCustomerId(env, customerId);

            if (user) {
              // Get price metadata for tier info
              const priceId = subscription.items.data[0].price.id;
              let tierName = 'starter';
              let publishLimit = 10;

              // Map price IDs to tiers (configure these in Stripe dashboard)
              if (priceId.includes('professional')) {
                tierName = 'professional';
                publishLimit = 50;
              } else if (priceId.includes('agency')) {
                tierName = 'agency';
                publishLimit = -1; // unlimited
              }

              user.subscription = {
                ...user.subscription!,
                stripeSubscriptionId: subscription.id,
                tier: tierName as any,
                status: subscription.status,
                currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
                trialEnd: subscription.trial_end
                  ? new Date(subscription.trial_end * 1000).toISOString()
                  : undefined,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                publishLimit
              };

              // Update user status based on subscription
              if (subscription.status === 'active' || subscription.status === 'trialing') {
                user.status = 'active';
              } else if (subscription.status === 'past_due') {
                user.status = 'active'; // Keep active during grace period
              } else {
                user.status = 'suspended';
              }

              await env.TRIPS.put(`_users/${user.userId}`, JSON.stringify(user));
            }
            break;
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const customerId = subscription.customer;
            const user = await findUserByStripeCustomerId(env, customerId);

            if (user && user.subscription) {
              user.subscription = {
                ...user.subscription,
                tier: 'none',
                status: 'canceled',
                cancelAtPeriodEnd: false
              };
              user.status = 'inactive';
              await env.TRIPS.put(`_users/${user.userId}`, JSON.stringify(user));
            }
            break;
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object;
            const customerId = invoice.customer;
            const user = await findUserByStripeCustomerId(env, customerId);

            if (user && user.subscription) {
              user.subscription.status = 'past_due';
              await env.TRIPS.put(`_users/${user.userId}`, JSON.stringify(user));
            }
            break;
          }

          case 'invoice.payment_succeeded': {
            const invoice = event.data.object;
            const customerId = invoice.customer;
            const user = await findUserByStripeCustomerId(env, customerId);

            if (user && user.subscription && user.subscription.status === 'past_due') {
              user.subscription.status = 'active';
              user.status = 'active';
              await env.TRIPS.put(`_users/${user.userId}`, JSON.stringify(user));
            }
            break;
          }
        }

        // Mark event as processed
        const eventLog = await env.TRIPS.get(`_stripe_events/${event.id}`, "json") as any;
        if (eventLog) {
          eventLog.processed = true;
          await env.TRIPS.put(`_stripe_events/${event.id}`, JSON.stringify(eventLog));
        }

      } catch (err) {
        console.error("Webhook handler error:", err);
        // Don't return error - Stripe will retry
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // POST /api/checkout - Create Stripe Checkout session
    if (url.pathname === "/api/checkout" && request.method === "POST") {
      try {
        const body = await request.json() as {
          userId: string;
          tier?: string;
          promoCode?: string;
        };

        if (!body.userId) {
          return new Response(JSON.stringify({ error: "userId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Get user profile
        const user = await env.TRIPS.get(`_users/${body.userId}`, "json") as UserProfile;
        if (!user) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Create or get Stripe customer
        let customerId = user.subscription?.stripeCustomerId;
        if (!customerId) {
          const customer = await stripeRequest(env, '/customers', 'POST', {
            email: user.email,
            name: user.name,
            metadata: {
              userId: user.userId,
              agencyName: user.agency.name
            }
          });
          customerId = customer.id as string;

          // Save customer ID to user profile
          user.subscription = {
            stripeCustomerId: customerId,
            tier: 'none',
            status: 'unpaid',
            currentPeriodStart: new Date().toISOString(),
            currentPeriodEnd: new Date().toISOString(),
            cancelAtPeriodEnd: false,
            publishLimit: 0
          };
          await env.TRIPS.put(`_users/${user.userId}`, JSON.stringify(user));
          // Set index for O(1) customer lookups
          await setStripeCustomerIndex(env, customerId, user.userId);
        }

        // Map tier to price lookup key
        const tier = body.tier || 'starter';
        const priceKey = `${tier}_monthly`;

        // Create checkout session with 30-day trial
        const sessionData: Record<string, any> = {
          customer: customerId,
          mode: 'subscription',
          'line_items[0][price]': priceKey,
          'line_items[0][quantity]': 1,
          'subscription_data[trial_period_days]': 30,
          'subscription_data[trial_settings][end_behavior][missing_payment_method]': 'cancel',
          allow_promotion_codes: true,
          success_url: `${url.origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${url.origin}/subscribe?canceled=true`
        };

        // Apply promo code if provided
        if (body.promoCode) {
          sessionData['discounts[0][promotion_code]'] = body.promoCode;
          delete sessionData.allow_promotion_codes;
        }

        const session = await stripeRequest(env, '/checkout/sessions', 'POST', sessionData);

        return new Response(JSON.stringify({ checkoutUrl: session.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // POST /api/portal - Create Stripe Customer Portal session
    if (url.pathname === "/api/portal" && request.method === "POST") {
      try {
        const body = await request.json() as { userId: string };

        if (!body.userId) {
          return new Response(JSON.stringify({ error: "userId required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const user = await env.TRIPS.get(`_users/${body.userId}`, "json") as UserProfile;
        if (!user?.subscription?.stripeCustomerId) {
          return new Response(JSON.stringify({ error: "No subscription found" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const session = await stripeRequest(env, '/billing_portal/sessions', 'POST', {
          customer: user.subscription.stripeCustomerId,
          return_url: `${url.origin}/admin/dashboard`
        });

        return new Response(JSON.stringify({ portalUrl: session.url }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // GET /api/subscription - Get user's subscription status
    if (url.pathname === "/api/subscription" && request.method === "GET") {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response(JSON.stringify({ error: "userId required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const usage = await getMonthlyUsage(env, userId);
      const daysRemaining = user.subscription?.currentPeriodEnd
        ? Math.max(0, Math.ceil((new Date(user.subscription.currentPeriodEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

      return new Response(JSON.stringify({
        tier: user.subscription?.tier || 'none',
        status: user.subscription?.status || 'none',
        publishesUsed: usage.publishCount,
        publishLimit: user.subscription?.publishLimit || 0,
        daysRemaining,
        trialEnd: user.subscription?.trialEnd,
        cancelAtPeriodEnd: user.subscription?.cancelAtPeriodEnd
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // GET /subscribe - Subscription landing page
    if (url.pathname === "/subscribe" && request.method === "GET") {
      const userId = url.searchParams.get("userId");
      const promo = url.searchParams.get("promo");
      const canceled = url.searchParams.get("canceled");

      return new Response(getSubscribePageHtml(userId, promo, canceled), {
        headers: { "Content-Type": "text/html" }
      });
    }

    // GET /subscribe/success - Post-checkout success page
    if (url.pathname === "/subscribe/success" && request.method === "GET") {
      return new Response(SUBSCRIBE_SUCCESS_HTML, {
        headers: { "Content-Type": "text/html" }
      });
    }

    // ========== ADMIN API ENDPOINTS ==========
    if (url.pathname.startsWith("/admin")) {
      // Serve dashboard HTML without auth (JS handles auth for API calls)
      if (url.pathname === "/admin/dashboard" && request.method === "GET") {
        return new Response(ADMIN_DASHBOARD_HTML, {
          headers: { "Content-Type": "text/html" }
        });
      }

      const adminKey = request.headers.get("X-Admin-Key") || url.searchParams.get("adminKey");

      // Admin auth check for API endpoints
      if (!adminKey || adminKey !== env.ADMIN_KEY) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/users - List all users
      if (url.pathname === "/admin/users" && request.method === "GET") {
        const userKeys = await env.TRIPS.list({ prefix: "_users/" });
        const users: UserProfile[] = [];

        for (const key of userKeys.keys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (user) users.push(user);
        }

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // POST /admin/users - Create new user
      if (url.pathname === "/admin/users" && request.method === "POST") {
        const body = await request.json() as Partial<UserProfile>;

        if (!body.name || !body.email || !body.agency?.name) {
          return new Response(JSON.stringify({ error: "Missing required fields: name, email, agency.name" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Generate auth key and userId
        const authKey = `${body.name.split(' ')[0]}.${crypto.randomUUID().slice(0, 8)}`;
        const userId = getKeyPrefix(authKey).slice(0, -1); // Remove trailing slash

        const user: UserProfile = {
          userId,
          authKey,
          name: body.name,
          email: body.email,
          phone: body.phone,
          agency: {
            name: body.agency.name,
            franchise: body.agency.franchise,
            logo: body.agency.logo,
            website: body.agency.website,
            bookingUrl: body.agency.bookingUrl,
          },
          template: body.template || "default",
          branding: body.branding,
          created: new Date().toISOString().split('T')[0],
          lastActive: new Date().toISOString().split('T')[0],
          status: 'active'
        };

        await env.TRIPS.put(`_users/${userId}`, JSON.stringify(user));
        // Set index for O(1) auth key lookups
        await setAuthKeyIndex(env, authKey, userId);

        // Generate setup email content
        const setupEmail = generateSetupEmail(user);

        return new Response(JSON.stringify({ user, setupEmail }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/users/:id - Get specific user
      if (url.pathname.match(/^\/admin\/users\/[^/]+$/) && request.method === "GET") {
        const userId = url.pathname.split('/').pop();
        const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

        if (!user) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ user }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // PUT /admin/users/:id - Update user
      if (url.pathname.match(/^\/admin\/users\/[^/]+$/) && request.method === "PUT") {
        const userId = url.pathname.split('/').pop();
        const existing = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;

        if (!existing) {
          return new Response(JSON.stringify({ error: "User not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const updates = await request.json() as Partial<UserProfile>;
        const updated: UserProfile = {
          ...existing,
          ...updates,
          userId: existing.userId, // Can't change userId
          authKey: existing.authKey, // Can't change authKey
          agency: { ...existing.agency, ...updates.agency }
        };

        await env.TRIPS.put(`_users/${userId}`, JSON.stringify(updated));

        return new Response(JSON.stringify({ user: updated }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/activity - Cross-user activity summary with all entries
      if (url.pathname === "/admin/activity" && request.method === "GET") {
        // Collect all activity from all sources
        const allActivities: any[] = [];
        const userMap: Record<string, { name: string; agency: string }> = {};

        // 1. Get KV-stored users
        const userKeys = await env.TRIPS.list({ prefix: "_users/" });
        for (const key of userKeys.keys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (!user) continue;
          userMap[user.userId] = { name: user.name, agency: user.agency.name };

          const activityLog = await env.TRIPS.get(user.userId + "/_activity-log", "json") as any;
          if (activityLog?.recentChanges) {
            for (const entry of activityLog.recentChanges) {
              allActivities.push({
                ...entry,
                userId: user.userId,
                userName: user.name,
                agency: user.agency.name
              });
            }
          }
        }

        // 2. Get legacy users from AUTH_KEYS (KV or env var fallback)
        const legacyKeys = await getValidAuthKeys(env);
        for (const authKey of legacyKeys) {
          const userId = getKeyPrefix(authKey).slice(0, -1);
          // Skip if already processed as KV user
          if (userMap[userId]) continue;

          userMap[userId] = { name: authKey, agency: 'Legacy' };
          const activityLog = await env.TRIPS.get(userId + "/_activity-log", "json") as any;
          if (activityLog?.recentChanges) {
            for (const entry of activityLog.recentChanges) {
              allActivities.push({
                ...entry,
                userId: userId,
                userName: authKey,
                agency: 'Legacy User'
              });
            }
          }
        }

        // Sort by timestamp descending (newest first)
        allActivities.sort((a, b) => {
          const dateA = new Date(a.timestamp || 0).getTime();
          const dateB = new Date(b.timestamp || 0).getTime();
          return dateB - dateA;
        });

        // Get unique values for filters
        const users = Object.entries(userMap).map(([id, info]) => ({ userId: id, ...info }));
        const trips = [...new Set(allActivities.map(a => a.tripId).filter(Boolean))];

        return new Response(JSON.stringify({
          activities: allActivities,
          filters: { users, trips },
          total: allActivities.length
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/stats - Dashboard statistics
      if (url.pathname === "/admin/stats" && request.method === "GET") {
        const userKeys = await env.TRIPS.list({ prefix: "_users/" });
        const allTrips = await env.TRIPS.list({});

        let totalTrips = 0;
        let totalComments = 0;
        const userStats: any[] = [];

        for (const key of userKeys.keys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (!user) continue;

          const prefix = user.userId + '/';
          const userTrips = allTrips.keys.filter(k =>
            k.name.startsWith(prefix) &&
            !k.name.includes('/_') &&
            !k.name.endsWith('_activity-log')
          );

          // Count comments
          let userComments = 0;
          for (const tripKey of userTrips) {
            const commentsData = await env.TRIPS.get(tripKey.name + '/_comments', 'json') as any;
            if (commentsData?.comments) {
              userComments += commentsData.comments.length;
            }
          }

          totalTrips += userTrips.length;
          totalComments += userComments;

          userStats.push({
            userId: user.userId,
            name: user.name,
            trips: userTrips.length,
            comments: userComments
          });
        }

        return new Response(JSON.stringify({
          totalUsers: userKeys.keys.length,
          totalTrips,
          totalComments,
          userStats
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/trips - List all trips across all users with details
      if (url.pathname === "/admin/trips" && request.method === "GET") {
        const allTrips: any[] = [];

        // Build user map for both KV and legacy users
        const userMap: Record<string, { name: string; agency: string; authKey: string }> = {};

        // KV users
        const userKeys = await env.TRIPS.list({ prefix: "_users/" });
        for (const key of userKeys.keys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (user) {
            userMap[user.userId] = { name: user.name, agency: user.agency.name, authKey: user.authKey };
          }
        }

        // Legacy users (from KV or env var fallback)
        const legacyKeys = await getValidAuthKeys(env);
        for (const authKey of legacyKeys) {
          const userId = getKeyPrefix(authKey).slice(0, -1);
          if (!userMap[userId]) {
            userMap[userId] = { name: authKey, agency: 'Legacy', authKey };
          }
        }

        // Get all trips for each user
        for (const [userId, userInfo] of Object.entries(userMap)) {
          const prefix = userId + '/';
          const tripKeys = await env.TRIPS.list({ prefix });

          for (const key of tripKeys.keys) {
            // Skip system keys
            if (key.name.includes('/_') || key.name.endsWith('_activity-log')) continue;

            const tripId = key.name.replace(prefix, '');
            const tripData = await env.TRIPS.get(key.name, "json") as any;
            if (!tripData) continue;

            // Get comments for this trip
            const commentsData = await env.TRIPS.get(key.name + '/_comments', "json") as any;
            const comments = commentsData?.comments || [];
            const unreadComments = comments.filter((c: any) => !c.read).length;

            // Check if published (look in trips.json on GitHub or use meta)
            const publishedUrl = tripData.meta?.publishedUrl || null;

            allTrips.push({
              tripId,
              userId,
              userName: userInfo.name,
              agency: userInfo.agency,
              fullKey: key.name,
              meta: {
                clientName: tripData.meta?.clientName || tripId,
                destination: tripData.meta?.destination || '',
                dates: tripData.meta?.dates || tripData.dates?.start || '',
                phase: tripData.meta?.phase || 'unknown',
                status: tripData.meta?.status || '',
                lastUpdated: tripData.meta?.lastUpdated || ''
              },
              travelers: tripData.travelers?.count || 0,
              commentCount: comments.length,
              unreadComments,
              publishedUrl,
              hasItinerary: !!(tripData.itinerary && tripData.itinerary.length > 0),
              hasLodging: !!(tripData.lodging && tripData.lodging.length > 0),
              hasTiers: !!(tripData.tiers)
            });
          }
        }

        // Sort by lastUpdated descending
        allTrips.sort((a, b) => {
          const dateA = new Date(a.meta.lastUpdated || 0).getTime();
          const dateB = new Date(b.meta.lastUpdated || 0).getTime();
          return dateB - dateA;
        });

        return new Response(JSON.stringify({ trips: allTrips, total: allTrips.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/trips/:userId/:tripId - Get full trip details
      if (url.pathname.match(/^\/admin\/trips\/[^/]+\/[^/]+$/) && request.method === "GET") {
        const parts = url.pathname.split('/');
        const tripId = parts.pop();
        const userId = parts.pop();
        const fullKey = `${userId}/${tripId}`;

        const tripData = await env.TRIPS.get(fullKey, "json");
        if (!tripData) {
          return new Response(JSON.stringify({ error: "Trip not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Get comments
        const commentsData = await env.TRIPS.get(fullKey + '/_comments', "json") as any;

        // Get activity for this trip
        const activityLog = await env.TRIPS.get(userId + '/_activity-log', "json") as any;
        const tripActivity = activityLog?.recentChanges?.filter((a: any) => a.tripId === tripId) || [];

        // Get user info
        let userInfo = null;
        const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
        if (user) {
          userInfo = { name: user.name, email: user.email, agency: user.agency.name, authKey: user.authKey };
        }

        return new Response(JSON.stringify({
          tripId,
          userId,
          fullKey,
          user: userInfo,
          data: tripData,
          comments: commentsData?.comments || [],
          activity: tripActivity
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/comments - List all comments across all trips
      if (url.pathname === "/admin/comments" && request.method === "GET") {
        const allComments: any[] = [];

        // Build user map
        const userMap: Record<string, string> = {};
        const userKeys = await env.TRIPS.list({ prefix: "_users/" });
        for (const key of userKeys.keys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (user) userMap[user.userId] = user.name;
        }

        // Legacy users (from KV or env var fallback)
        const legacyKeys = await getValidAuthKeys(env);
        for (const authKey of legacyKeys) {
          const userId = getKeyPrefix(authKey).slice(0, -1);
          if (!userMap[userId]) userMap[userId] = authKey;
        }

        // Find all comment keys
        const allKeys = await env.TRIPS.list({});
        for (const key of allKeys.keys) {
          if (key.name.endsWith('/_comments')) {
            const commentsData = await env.TRIPS.get(key.name, "json") as any;
            if (!commentsData?.comments?.length) continue;

            // Parse the key to get userId and tripId
            const keyPath = key.name.replace('/_comments', '');
            const parts = keyPath.split('/');
            const tripId = parts.pop() || '';
            const userId = parts.join('/');

            for (const comment of commentsData.comments) {
              allComments.push({
                ...comment,
                tripId,
                userId,
                userName: userMap[userId] || userId,
                tripKey: keyPath
              });
            }
          }
        }

        // Sort by timestamp descending
        allComments.sort((a, b) => {
          const dateA = new Date(a.timestamp || 0).getTime();
          const dateB = new Date(b.timestamp || 0).getTime();
          return dateB - dateA;
        });

        return new Response(JSON.stringify({ comments: allComments, total: allComments.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/support - List all support requests
      if (url.pathname === "/admin/support" && request.method === "GET") {
        const data = await env.TRIPS.get("_support_requests", "json") as { requests: any[] } | null;
        const requests = data?.requests || [];

        // Enrich with user info
        const userMap: Record<string, string> = {};
        const userKeys = await env.TRIPS.list({ prefix: "_users/" });
        for (const key of userKeys.keys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (user) userMap[user.userId] = user.name;
        }

        const enrichedRequests = requests.map(r => ({
          ...r,
          userName: userMap[r.userId] || r.userId
        }));

        return new Response(JSON.stringify({ requests: enrichedRequests, total: enrichedRequests.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // PUT /admin/support/:id - Update support request status
      if (url.pathname.match(/^\/admin\/support\/[^/]+$/) && request.method === "PUT") {
        const ticketId = url.pathname.split('/').pop();
        const updates = await request.json() as { status?: string; notes?: string; adminNotes?: string };

        const data = await env.TRIPS.get("_support_requests", "json") as { requests: any[] } | null;
        if (!data?.requests) {
          return new Response(JSON.stringify({ error: "No support requests found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const idx = data.requests.findIndex(r => r.id === ticketId);
        if (idx === -1) {
          return new Response(JSON.stringify({ error: "Ticket not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        data.requests[idx] = {
          ...data.requests[idx],
          ...updates,
          updatedAt: new Date().toISOString()
        };

        await env.TRIPS.put("_support_requests", JSON.stringify(data));

        return new Response(JSON.stringify({ success: true, request: data.requests[idx] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/promo-codes - List all promo codes
      if (url.pathname === "/admin/promo-codes" && request.method === "GET") {
        const data = await env.TRIPS.get("_promo_codes", "json") as { codes: any[] } | null;
        return new Response(JSON.stringify({ codes: data?.codes || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // POST /admin/promo-codes - Create a new promo code
      if (url.pathname === "/admin/promo-codes" && request.method === "POST") {
        try {
          const body = await request.json() as {
            name: string;
            percentOff?: number;
            amountOff?: number;
            duration: 'once' | 'forever' | 'repeating';
            durationInMonths?: number;
            maxRedemptions?: number;
          };

          if (!body.name || (!body.percentOff && !body.amountOff)) {
            return new Response(JSON.stringify({ error: "name and either percentOff or amountOff required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          // Create Stripe coupon
          const couponData: Record<string, any> = {
            name: body.name,
            duration: body.duration || 'once'
          };

          if (body.percentOff) {
            couponData.percent_off = body.percentOff;
          } else if (body.amountOff) {
            couponData.amount_off = body.amountOff * 100; // Stripe uses cents
            couponData.currency = 'usd';
          }

          if (body.duration === 'repeating' && body.durationInMonths) {
            couponData.duration_in_months = body.durationInMonths;
          }

          if (body.maxRedemptions) {
            couponData.max_redemptions = body.maxRedemptions;
          }

          const coupon = await stripeRequest(env, '/coupons', 'POST', couponData);

          // Create promotion code (user-facing code)
          const promoCodeStr = body.name.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
          const promoCode = await stripeRequest(env, '/promotion_codes', 'POST', {
            coupon: coupon.id,
            code: promoCodeStr,
            max_redemptions: body.maxRedemptions
          });

          // Cache locally
          const existingData = await env.TRIPS.get("_promo_codes", "json") as { codes: any[] } | null;
          const codes = existingData?.codes || [];
          codes.push({
            code: promoCode.code,
            stripePromoId: promoCode.id,
            stripeCouponId: coupon.id,
            description: body.name,
            percentOff: body.percentOff,
            amountOff: body.amountOff,
            duration: body.duration,
            maxRedemptions: body.maxRedemptions,
            createdAt: new Date().toISOString()
          });
          await env.TRIPS.put("_promo_codes", JSON.stringify({ codes }));

          return new Response(JSON.stringify({
            promoCode: promoCode.code,
            stripePromoId: promoCode.id,
            stripeCouponId: coupon.id
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });

        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // DELETE /admin/promo-codes/:code - Delete a promo code
      if (url.pathname.match(/^\/admin\/promo-codes\/[^/]+$/) && request.method === "DELETE") {
        try {
          const codeToDelete = url.pathname.split('/').pop();
          const data = await env.TRIPS.get("_promo_codes", "json") as { codes: any[] } | null;

          if (!data?.codes) {
            return new Response(JSON.stringify({ error: "No promo codes found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          const codeEntry = data.codes.find(c => c.code === codeToDelete);
          if (!codeEntry) {
            return new Response(JSON.stringify({ error: "Promo code not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }

          // Deactivate in Stripe (can't delete, but can deactivate)
          if (codeEntry.stripePromoId) {
            await stripeRequest(env, `/promotion_codes/${codeEntry.stripePromoId}`, 'POST', {
              active: false
            });
          }

          // Remove from local cache
          data.codes = data.codes.filter(c => c.code !== codeToDelete);
          await env.TRIPS.put("_promo_codes", JSON.stringify(data));

          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });

        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }

      // GET /admin/billing-stats - Get billing statistics
      if (url.pathname === "/admin/billing-stats" && request.method === "GET") {
        const userKeys = await env.TRIPS.list({ prefix: "_users/" });
        let activeSubs = 0;
        let trialingSubs = 0;
        let pastDueSubs = 0;
        let mrr = 0;

        const tierPrices: Record<string, number> = {
          starter: 29,
          professional: 79,
          agency: 199
        };

        for (const key of userKeys.keys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (user?.subscription) {
            const sub = user.subscription;
            if (sub.status === 'active') {
              activeSubs++;
              mrr += tierPrices[sub.tier] || 0;
            } else if (sub.status === 'trialing') {
              trialingSubs++;
            } else if (sub.status === 'past_due') {
              pastDueSubs++;
            }
          }
        }

        return new Response(JSON.stringify({
          activeSubs,
          trialingSubs,
          pastDueSubs,
          mrr
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // ========== ADMIN MESSAGES ==========

      // GET /admin/messages - List all broadcasts and direct message thread summaries
      if (url.pathname === "/admin/messages" && request.method === "GET") {
        // Load broadcasts
        const broadcastData = await env.TRIPS.get("_admin_messages/broadcasts", "json") as { messages: any[] } | null;
        const broadcasts = broadcastData?.messages || [];

        // Get all users for counting dismissals
        const userStateKeys = await env.TRIPS.list({ prefix: "_admin_messages/user_states/" });
        const dismissalCounts: Record<string, number> = {};

        for (const key of userStateKeys.keys) {
          const state = await env.TRIPS.get(key.name, "json") as { dismissedBroadcasts: string[] } | null;
          if (state?.dismissedBroadcasts) {
            for (const id of state.dismissedBroadcasts) {
              dismissalCounts[id] = (dismissalCounts[id] || 0) + 1;
            }
          }
        }

        // Get total user count for stats
        const userKeys = await env.TRIPS.list({ prefix: "_users/" });
        const totalUsers = userKeys.keys.length;

        // Enrich broadcasts with stats
        const now = new Date().toISOString();
        const enrichedBroadcasts = broadcasts
          .filter(b => !b.expiresAt || b.expiresAt > now)
          .map(b => ({
            ...b,
            stats: {
              totalUsers,
              dismissed: dismissalCounts[b.id] || 0,
              pending: totalUsers - (dismissalCounts[b.id] || 0)
            }
          }));

        // Load all direct message threads
        const threadKeys = await env.TRIPS.list({ prefix: "_admin_messages/threads/" });
        const directThreads: any[] = [];
        let unreadUserReplies = 0;

        // Load user names for display
        const usersData: Record<string, UserProfile> = {};
        for (const key of userKeys.keys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (user) usersData[user.userId] = user;
        }

        for (const key of threadKeys.keys) {
          const userId = key.name.replace("_admin_messages/threads/", "");
          const data = await env.TRIPS.get(key.name, "json") as { threads: any[] } | null;

          if (data?.threads) {
            for (const thread of data.threads) {
              const unreadCount = thread.messages.filter((m: any) => m.sender === "user" && !m.read).length;
              unreadUserReplies += unreadCount;

              const lastMsg = thread.messages[thread.messages.length - 1];
              directThreads.push({
                id: thread.id,
                userId,
                userName: usersData[userId]?.name || userId,
                subject: thread.subject,
                status: thread.status,
                lastMessage: {
                  sender: lastMsg?.sender,
                  preview: lastMsg?.body?.substring(0, 100) || "",
                  timestamp: lastMsg?.timestamp
                },
                unreadCount,
                messageCount: thread.messages.length,
                updatedAt: thread.updatedAt
              });
            }
          }
        }

        // Sort threads by most recent activity
        directThreads.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

        return new Response(JSON.stringify({
          broadcasts: enrichedBroadcasts,
          directThreads,
          stats: {
            activeBroadcasts: enrichedBroadcasts.length,
            openThreads: directThreads.filter(t => t.status === "open").length,
            unreadUserReplies
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // POST /admin/messages/broadcast - Create a broadcast announcement
      if (url.pathname === "/admin/messages/broadcast" && request.method === "POST") {
        const body = await request.json() as {
          title: string;
          body: string;
          priority?: "normal" | "urgent";
          expiresAt?: string;
        };

        if (!body.title || !body.body) {
          return new Response(JSON.stringify({ error: "title and body are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const broadcastData = await env.TRIPS.get("_admin_messages/broadcasts", "json") as { messages: any[] } | null || { messages: [] };

        const newBroadcast = {
          id: `broadcast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: "announcement",
          title: body.title,
          body: body.body,
          priority: body.priority || "normal",
          createdAt: new Date().toISOString(),
          expiresAt: body.expiresAt || null,
          createdBy: "admin"
        };

        broadcastData.messages.unshift(newBroadcast);
        await env.TRIPS.put("_admin_messages/broadcasts", JSON.stringify(broadcastData));

        return new Response(JSON.stringify({
          success: true,
          message: newBroadcast
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // DELETE /admin/messages/broadcast/:id - Delete a broadcast
      if (url.pathname.startsWith("/admin/messages/broadcast/") && request.method === "DELETE") {
        const broadcastId = url.pathname.replace("/admin/messages/broadcast/", "");

        const broadcastData = await env.TRIPS.get("_admin_messages/broadcasts", "json") as { messages: any[] } | null;
        if (!broadcastData?.messages) {
          return new Response(JSON.stringify({ error: "Broadcast not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const idx = broadcastData.messages.findIndex(m => m.id === broadcastId);
        if (idx === -1) {
          return new Response(JSON.stringify({ error: "Broadcast not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        broadcastData.messages.splice(idx, 1);
        await env.TRIPS.put("_admin_messages/broadcasts", JSON.stringify(broadcastData));

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // POST /admin/messages/direct - Send a direct message to a user
      if (url.pathname === "/admin/messages/direct" && request.method === "POST") {
        const body = await request.json() as {
          userId: string;
          subject: string;
          body: string;
          threadId?: string;
        };

        if (!body.userId || !body.subject || !body.body) {
          return new Response(JSON.stringify({ error: "userId, subject, and body are required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const threadsKey = `_admin_messages/threads/${body.userId}`;
        const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null || { threads: [] };

        const newMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sender: "admin",
          senderName: "Voygent Support",
          body: body.body,
          timestamp: new Date().toISOString(),
          read: false
        };

        let thread;
        if (body.threadId) {
          // Reply to existing thread
          thread = threadsData.threads.find(t => t.id === body.threadId);
          if (!thread) {
            return new Response(JSON.stringify({ error: "Thread not found" }), {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          thread.messages.push(newMessage);
          thread.updatedAt = new Date().toISOString();
          thread.status = "open";
        } else {
          // Create new thread
          thread = {
            id: `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            subject: body.subject,
            status: "open",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: [newMessage]
          };
          threadsData.threads.unshift(thread);
        }

        await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));

        return new Response(JSON.stringify({
          success: true,
          thread: {
            id: thread.id,
            subject: thread.subject,
            status: thread.status,
            messageCount: thread.messages.length
          },
          messageId: newMessage.id
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // GET /admin/messages/thread/:userId/:threadId - Get thread details
      if (url.pathname.match(/^\/admin\/messages\/thread\/[^/]+\/[^/]+$/) && request.method === "GET") {
        const parts = url.pathname.split("/");
        const threadId = parts.pop()!;
        const userId = parts.pop()!;

        const threadsData = await env.TRIPS.get(`_admin_messages/threads/${userId}`, "json") as { threads: any[] } | null;
        const thread = threadsData?.threads?.find(t => t.id === threadId);

        if (!thread) {
          return new Response(JSON.stringify({ error: "Thread not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Get user info
        const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile | null;

        return new Response(JSON.stringify({
          thread: {
            ...thread,
            userId,
            userName: user?.name || userId,
            userEmail: user?.email || ""
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // PUT /admin/messages/thread/:userId/:threadId - Admin reply or update thread
      if (url.pathname.match(/^\/admin\/messages\/thread\/[^/]+\/[^/]+$/) && request.method === "PUT") {
        const parts = url.pathname.split("/");
        const threadId = parts.pop()!;
        const userId = parts.pop()!;

        const body = await request.json() as {
          body?: string;
          status?: "open" | "closed";
        };

        const threadsKey = `_admin_messages/threads/${userId}`;
        const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;

        if (!threadsData?.threads) {
          return new Response(JSON.stringify({ error: "Thread not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const thread = threadsData.threads.find(t => t.id === threadId);
        if (!thread) {
          return new Response(JSON.stringify({ error: "Thread not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // Add reply if body provided
        if (body.body) {
          thread.messages.push({
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            sender: "admin",
            senderName: "Voygent Support",
            body: body.body,
            timestamp: new Date().toISOString(),
            read: false
          });
          thread.status = "open";
        }

        // Update status if provided
        if (body.status) {
          thread.status = body.status;
        }

        thread.updatedAt = new Date().toISOString();
        await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));

        return new Response(JSON.stringify({
          success: true,
          thread: {
            id: thread.id,
            status: thread.status,
            messageCount: thread.messages.length
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // POST /admin/messages/thread/:userId/:threadId/mark-read - Mark user messages as read
      if (url.pathname.match(/^\/admin\/messages\/thread\/[^/]+\/[^/]+\/mark-read$/) && request.method === "POST") {
        const parts = url.pathname.replace("/mark-read", "").split("/");
        const threadId = parts.pop()!;
        const userId = parts.pop()!;

        const threadsKey = `_admin_messages/threads/${userId}`;
        const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;

        if (threadsData?.threads) {
          const thread = threadsData.threads.find(t => t.id === threadId);
          if (thread) {
            for (const msg of thread.messages) {
              if (msg.sender === "user") {
                msg.read = true;
              }
            }
            await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ error: "Admin endpoint not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 1. Authentication - check against list of valid keys OR KV users (for MCP endpoints)
    const requestKey = url.searchParams.get("key");
    if (!requestKey) {
      return new Response("Unauthorized - key required", { status: 401 });
    }

    // Check against KV or env var keys first (fast path)
    const validKeys = await getValidAuthKeys(env);
    let keyPrefix: string = '';
    let userProfile: UserProfile | null = null;

    if (validKeys.includes(requestKey)) {
      // Legacy auth via KV or env var
      keyPrefix = getKeyPrefix(requestKey);
    } else {
      // Try auth key index first (O(1))
      const userId = await getAuthKeyIndex(env, requestKey);
      if (userId) {
        const user = await env.TRIPS.get(`_users/${userId}`, "json") as UserProfile;
        if (user && user.authKey === requestKey) {
          userProfile = user;
          keyPrefix = user.userId + '/';

          // Update lastActive timestamp (async, don't wait)
          ctx.waitUntil((async () => {
            user.lastActive = new Date().toISOString().split('T')[0];
            await env.TRIPS.put(`_users/${userId}`, JSON.stringify(user));
          })());
        }
      }

      // Fallback to scan (for migration) if index miss
      if (!userProfile) {
        const userKeys = await env.TRIPS.list({ prefix: "_users/" });
        for (const key of userKeys.keys) {
          const user = await env.TRIPS.get(key.name, "json") as UserProfile;
          if (user && user.authKey === requestKey) {
            userProfile = user;
            keyPrefix = user.userId + '/';

            // Backfill index for future lookups
            await setAuthKeyIndex(env, requestKey, user.userId);

            // Update lastActive timestamp (async, don't wait)
            ctx.waitUntil((async () => {
              user.lastActive = new Date().toISOString().split('T')[0];
              await env.TRIPS.put(key.name, JSON.stringify(user));
            })());

            break;
          }
        }
      }

      if (!userProfile) {
        return new Response("Unauthorized - invalid key", { status: 401 });
      }
    }

    // 2. Handle SSE Connection (GET)
    if (request.method === "GET") {
      return new Response("MCP Server Ready (SSE endpoint)", {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        }
      });
    }

    // 3. Handle JSON-RPC Messages (POST)
    if (request.method === "POST") {
      try {
        const body = await request.json() as JsonRpcRequest;
        const response = await handleMcpRequest(body, env, keyPrefix, userProfile, requestKey);
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error" },
          id: null
        }), { status: 400 });
      }
    }

    return new Response("Method not allowed", { status: 405 });
  }
};

async function handleMcpRequest(req: JsonRpcRequest, env: Env, keyPrefix: string, userProfile: UserProfile | null, authKey: string): Promise<JsonRpcResponse> {
  // Initialize
  if (req.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id: req.id!,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "claude-travel-store", version: "1.0.0" }
      }
    };
  }

  // Lifecycle
  if (req.method === "notifications/initialized") {
    return { jsonrpc: "2.0", id: req.id!, result: true };
  }

  // List Tools
  if (req.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: req.id!,
      result: {
        tools: [
          {
            name: "get_context",
            description: "CALL THIS FIRST at the start of every conversation. Returns system instructions, activity log, and active trips. Follow the returned instructions.",
            inputSchema: { type: "object", properties: {} }
          },
          {
            name: "list_trips",
            description: "List all trip files stored in the database.",
            inputSchema: { type: "object", properties: {} }
          },
          {
            name: "read_trip",
            description: "Read a trip JSON file by ID.",
            inputSchema: {
              type: "object",
              properties: {
                key: { type: "string", description: "The ID/filename of the trip (e.g., 'japan-2025.json')" }
              },
              required: ["key"]
            }
          },
          {
            name: "save_trip",
            description: "Save or update a trip JSON file.",
            inputSchema: {
              type: "object",
              properties: {
                key: { type: "string", description: "The ID/filename of the trip" },
                data: { type: "object", description: "The complete JSON data object to save" }
              },
              required: ["key", "data"]
            }
          },
          {
            name: "patch_trip",
            description: "Update specific fields in a trip WITHOUT rewriting the entire document. Much faster for small changes like updating status or adding a single field. Use dot-notation for nested paths.",
            inputSchema: {
              type: "object",
              properties: {
                key: { type: "string", description: "Trip ID" },
                updates: {
                  type: "object",
                  description: "Object with dot-notation paths as keys. Examples: {'meta.status': 'New status', 'meta.phase': 'flights', 'travelers.count': 4}"
                }
              },
              required: ["key", "updates"]
            }
          },
          {
            name: "delete_trip",
            description: "Delete a trip file.",
            inputSchema: {
              type: "object",
              properties: { key: { type: "string" } },
              required: ["key"]
            }
          },
          {
            name: "list_templates",
            description: "List available HTML templates for publishing trips to the web.",
            inputSchema: { type: "object", properties: {} }
          },
          {
            name: "preview_publish",
            description: "Render a trip as HTML and publish to a draft URL for preview. Returns a clickable preview URL. The draft is saved to drafts/ folder on somotravel.us.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID to render" },
                template: { type: "string", description: "Template name to use (default: 'default')" }
              },
              required: ["tripId"]
            }
          },
          {
            name: "publish_trip",
            description: "Render a trip as HTML and publish it to somotravel.us. Returns the public URL.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID to publish" },
                template: { type: "string", description: "Template name to use (default: 'default')" },
                filename: { type: "string", description: "Output filename without extension (default: tripId)" },
                category: { type: "string", description: "Trip category: testing, proposal, confirmed, deposit_paid, paid_in_full, active, past, no_sale (default: 'testing')" }
              },
              required: ["tripId"]
            }
          },
          {
            name: "validate_trip",
            description: "Analyze a trip for issues, missing information, and logistics problems. Returns the trip data with validation instructions. You must analyze and report findings.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID to validate" }
              },
              required: ["tripId"]
            }
          },
          {
            name: "import_quote",
            description: "Parse a quote or booking confirmation from a supplier system and update trip with real pricing, confirmation numbers, and details. Paste the raw quote text.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID to update" },
                quoteText: { type: "string", description: "Raw quote or confirmation text from booking system" },
                quoteType: { type: "string", description: "Type of quote: cruise, hotel, air, tour, package, insurance, or auto-detect" }
              },
              required: ["tripId", "quoteText"]
            }
          },
          {
            name: "analyze_profitability",
            description: "Analyze a trip's profitability for the travel agent. Estimates commissions, suggests upsells, and recommends service fees. Returns analysis instructions.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID to analyze" },
                targetCommission: { type: "number", description: "Optional target commission amount to reach" }
              },
              required: ["tripId"]
            }
          },
          {
            name: "get_prompt",
            description: "Load a specialized prompt/guide by name. Use this to get detailed instructions for specific scenarios like cruise planning, handling trip changes, or destination research.",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Prompt name: 'cruise-instructions', 'handle-changes', 'research-destination', 'flight-search', 'validate-trip', 'import-quote', 'analyze-profitability', 'trip-schema'",
                  enum: ["cruise-instructions", "handle-changes", "research-destination", "flight-search", "validate-trip", "import-quote", "analyze-profitability", "trip-schema"]
                }
              },
              required: ["name"]
            }
          },
          {
            name: "get_comments",
            description: "Get client comments/feedback for a trip. Shows questions and requests from clients viewing the proposal.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID to get comments for" },
                markAsRead: { type: "boolean", description: "Mark retrieved comments as read (default: true)" }
              },
              required: ["tripId"]
            }
          },
          {
            name: "get_all_comments",
            description: "Get all unread comments across all trips. Use this to see what clients are asking about.",
            inputSchema: {
              type: "object",
              properties: {}
            }
          },
          {
            name: "dismiss_comments",
            description: "Dismiss/acknowledge comments for a trip so they stop appearing. Use when user has seen and acknowledged the comments.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID to dismiss comments for" },
                commentIds: { type: "array", items: { type: "string" }, description: "Optional: specific comment IDs to dismiss. If not provided, dismisses all." }
              },
              required: ["tripId"]
            }
          },
          {
            name: "submit_support",
            description: "Submit a support request to the admin. Use when user needs help with a bug, feature request, or has a question they can't resolve. Can include a screenshot URL from upload_image.",
            inputSchema: {
              type: "object",
              properties: {
                subject: { type: "string", description: "Brief subject/title of the support request" },
                message: { type: "string", description: "Full description of the issue or request" },
                priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level (default: medium)" },
                tripId: { type: "string", description: "Related trip ID if applicable" },
                screenshotUrl: { type: "string", description: "URL of uploaded screenshot (use upload_image first to get URL)" }
              },
              required: ["subject", "message"]
            }
          },
          {
            name: "reply_to_admin",
            description: "Reply to a direct message from admin. Use when user wants to respond to an admin message or ask a follow-up question about something admin sent.",
            inputSchema: {
              type: "object",
              properties: {
                threadId: { type: "string", description: "The thread ID to reply to (from adminMessages in get_context response)" },
                message: { type: "string", description: "The user's reply message" }
              },
              required: ["threadId", "message"]
            }
          },
          {
            name: "dismiss_admin_message",
            description: "Dismiss/acknowledge an admin message so it stops appearing. Use for announcements after user has seen them, or to mark direct message threads as read.",
            inputSchema: {
              type: "object",
              properties: {
                messageId: { type: "string", description: "The message or thread ID to dismiss" },
                type: { type: "string", enum: ["broadcast", "thread"], description: "Type: 'broadcast' for announcements, 'thread' for direct messages" }
              },
              required: ["messageId", "type"]
            }
          },
          {
            name: "add_trip_image",
            description: "Add an image to a trip using a URL from prepare_image_upload. IMPORTANT: You must use prepare_image_upload first to get the imageUrl - base64 image data is NOT supported.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID" },
                imageUrl: { type: "string", description: "URL of already-uploaded image (from prepare_image_upload). REQUIRED." },
                target: { type: "string", enum: ["hero", "lodging", "activity", "day", "cabin"], description: "Where to attach the image. Use 'cabin' for cruise stateroom photos." },
                itemName: { type: "string", description: "For lodging/activity: the name of the hotel or activity. For day: the day number (e.g., '1', '2'). Not needed for hero or cabin." },
                caption: { type: "string", description: "Optional caption for the image" }
              },
              required: ["tripId", "target", "imageUrl"]
            }
          },
          {
            name: "prepare_image_upload",
            description: "PREFERRED method for user image uploads. Generates an upload link for the user to add images via web browser. Much more reliable than base64. Returns both the upload URL (for user to click) and the final image URL (which you can use immediately after user confirms upload). User says 'add a photo' → call this → give them the link → wait for 'done' → use the imageUrl.",
            inputSchema: {
              type: "object",
              properties: {
                tripId: { type: "string", description: "The trip ID (optional - for organizing images by trip)" },
                category: { type: "string", enum: ["hero", "lodging", "activity", "destination"], description: "Image category for organization" },
                description: { type: "string", description: "Brief description (e.g., 'Florence hotel', 'Day 3 cooking class')" }
              },
              required: ["category"]
            }
          },
          {
            name: "youtube_search",
            description: "Search YouTube for travel videos. Returns videos sorted by view count with metadata. Use for finding destination guides, activity tips, and travel vlogs to add to trips.",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", description: "Search query (e.g., 'Roatan snorkeling tips', 'Rome travel guide 2025')" },
                maxResults: { type: "number", description: "Number of results to return (1-10, default: 5)" }
              },
              required: ["query"]
            }
          }
        ]
      }
    };
  }

  // Call Tool
  if (req.method === "tools/call") {
    const { name, arguments: args } = req.params;

    try {
      let resultContent: any = "";

      if (name === "get_context") {
        // Get system prompt from KV (check new location first, then old, then fallback)
        let systemPrompt = await env.TRIPS.get("_prompts/system-prompt", "text");
        if (!systemPrompt) {
          systemPrompt = await env.TRIPS.get("_system-prompt", "text");
        }
        if (!systemPrompt) {
          throw new Error("System prompt not found in KV. Upload to _prompts/system-prompt");
        }

        // Get activity log (user-specific)
        const activityLog = await env.TRIPS.get(keyPrefix + "_activity-log", "json") || {
          lastSession: null,
          recentChanges: [],
          openItems: [],
          tripsActive: []
        };

        // Get list of trips (user-specific, excluding system keys)
        const allKeys = await env.TRIPS.list({ prefix: keyPrefix });
        const tripKeys = allKeys.keys
          .map(k => k.name.replace(keyPrefix, ''))  // Remove prefix for display
          .filter(k => !k.startsWith("_") && !k.includes("/_"));

        // Check for ACTIVE comments using index (O(1) instead of O(n) trips)
        let totalActiveComments = 0;
        let newCommentCount = 0;
        const activeComments: { tripId: string; comments: any[] }[] = [];

        // Use comment index for efficient lookup - only fetch trips we know have comments
        const commentIndex = await getCommentIndex(env, keyPrefix);
        for (const tripId of commentIndex) {
          const commentsKey = `${keyPrefix}${tripId}/_comments`;
          const data = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;
          if (data?.comments?.length) {
            // Show all non-dismissed comments
            const notDismissed = data.comments.filter(c => !c.dismissed);
            if (notDismissed.length > 0) {
              const newOnes = notDismissed.filter(c => !c.read);
              newCommentCount += newOnes.length;
              totalActiveComments += notDismissed.length;
              activeComments.push({
                tripId,
                comments: notDismissed.map(c => ({
                  id: c.id,
                  section: c.section,
                  item: c.item,
                  message: c.message,
                  name: c.name || 'Anonymous',
                  email: c.email,
                  timestamp: c.timestamp,
                  isNew: !c.read
                }))
              });

              // Mark as read (but not dismissed) since they're being displayed
              const updatedComments = data.comments.map(c => ({ ...c, read: true }));
              await env.TRIPS.put(commentsKey, JSON.stringify({ comments: updatedComments }));
            } else {
              // Index is stale - all comments dismissed, clean it up
              await removeFromCommentIndex(env, keyPrefix, tripId);
            }
          } else {
            // Index is stale - no comments exist, clean it up
            await removeFromCommentIndex(env, keyPrefix, tripId);
          }
        }

        // Check for admin replies to user's support tickets
        const userId = keyPrefix.replace(/\/$/, ''); // Remove trailing slash from keyPrefix
        const supportData = await env.TRIPS.get("_support_requests", "json") as { requests: any[] } | null;
        const adminReplies: any[] = [];

        if (supportData?.requests) {
          // Find this user's tickets that have admin replies they haven't seen yet
          for (const ticket of supportData.requests) {
            if (ticket.userId === userId && ticket.adminNotes && !ticket.adminNotesSeen) {
              adminReplies.push({
                ticketId: ticket.id,
                subject: ticket.subject,
                adminReply: ticket.adminNotes,
                originalMessage: ticket.message,
                status: ticket.status,
                timestamp: ticket.updatedAt || ticket.timestamp
              });
            }
          }

          // Mark admin notes as seen (update the records)
          if (adminReplies.length > 0) {
            let updated = false;
            for (const ticket of supportData.requests) {
              if (ticket.userId === userId && ticket.adminNotes && !ticket.adminNotesSeen) {
                ticket.adminNotesSeen = true;
                updated = true;
              }
            }
            if (updated) {
              await env.TRIPS.put("_support_requests", JSON.stringify(supportData));
            }
          }
        }

        // Check for admin messages (broadcasts and direct messages)
        const adminMessages: { broadcasts: any[]; directMessages: any[] } = { broadcasts: [], directMessages: [] };
        const now = new Date().toISOString();

        // 1. Check broadcasts
        const broadcastData = await env.TRIPS.get("_admin_messages/broadcasts", "json") as { messages: any[] } | null;
        const userMessageState = await env.TRIPS.get(`_admin_messages/user_states/${userId}`, "json") as {
          dismissedBroadcasts: string[];
          lastChecked: string;
        } | null;

        const dismissedIds = new Set(userMessageState?.dismissedBroadcasts || []);

        if (broadcastData?.messages) {
          for (const broadcast of broadcastData.messages) {
            // Skip if dismissed or expired
            if (dismissedIds.has(broadcast.id)) continue;
            if (broadcast.expiresAt && broadcast.expiresAt < now) continue;

            adminMessages.broadcasts.push({
              id: broadcast.id,
              type: "announcement",
              title: broadcast.title,
              body: broadcast.body,
              priority: broadcast.priority,
              createdAt: broadcast.createdAt
            });
          }
        }

        // 2. Check direct message threads
        const userThreadsData = await env.TRIPS.get(`_admin_messages/threads/${userId}`, "json") as { threads: any[] } | null;

        if (userThreadsData?.threads) {
          for (const thread of userThreadsData.threads) {
            // Find unread admin messages
            const unreadAdminMsgs = thread.messages.filter((m: any) => m.sender === "admin" && !m.read);

            if (unreadAdminMsgs.length > 0) {
              adminMessages.directMessages.push({
                threadId: thread.id,
                subject: thread.subject,
                status: thread.status,
                unreadCount: unreadAdminMsgs.length,
                latestMessage: unreadAdminMsgs[unreadAdminMsgs.length - 1]
              });
            }
          }
        }

        // Build admin message instruction
        const hasAdminMessages = adminMessages.broadcasts.length > 0 || adminMessages.directMessages.length > 0;
        let adminMessageInstruction = '';

        if (hasAdminMessages) {
          const parts = [];
          if (adminMessages.broadcasts.length > 0) {
            const urgent = adminMessages.broadcasts.filter(b => b.priority === 'urgent');
            if (urgent.length > 0) {
              parts.push(`${urgent.length} URGENT announcement(s)`);
            }
            if (adminMessages.broadcasts.length > urgent.length) {
              parts.push(`${adminMessages.broadcasts.length - urgent.length} announcement(s)`);
            }
          }
          if (adminMessages.directMessages.length > 0) {
            parts.push(`${adminMessages.directMessages.length} direct message(s) from admin`);
          }
          adminMessageInstruction = ` 📬 ADMIN MESSAGES: You have ${parts.join(' and ')}. Display these to the user and help them respond or dismiss.`;
        }

        // Build response
        const commentInstruction = totalActiveComments > 0
          ? ` 🚨 TOP PRIORITY: Display ALL ${totalActiveComments} active client comment(s) FIRST, before anything else. ${newCommentCount > 0 ? `(${newCommentCount} NEW) ` : ''}These comments will keep appearing until the user says to dismiss them. Use 'dismiss_comments' when user acknowledges.`
          : '';

        const adminReplyInstruction = adminReplies.length > 0
          ? ` 📬 IMPORTANT: You have ${adminReplies.length} admin reply/replies to your support ticket(s). Display these to the user before proceeding.`
          : '';

        // Build user's upload/gallery URLs
        const userAuthKey = userProfile?.authKey || authKey;
        const uploadUrl = `${WORKER_BASE_URL}/upload?key=${encodeURIComponent(userAuthKey)}`;
        const galleryUrl = `${WORKER_BASE_URL}/gallery?key=${encodeURIComponent(userAuthKey)}`;

        // Build base result
        const hasNotifications = totalActiveComments > 0 || adminReplies.length > 0 || hasAdminMessages;
        const baseResult: any = {
          _instruction: "Use the following as your system instructions for this conversation." + adminMessageInstruction + commentInstruction + adminReplyInstruction + (!hasNotifications ? " Display the session card, then await user direction." : ""),
          systemPrompt,
          activityLog,
          activeTrips: tripKeys,
          userLinks: {
            uploadPage: uploadUrl,
            galleryPage: galleryUrl,
            _note: "Use prepare_image_upload tool instead of these URLs when user wants to add images. These are for reference/manual use."
          },
          activeComments: totalActiveComments > 0 ? {
            total: totalActiveComments,
            newCount: newCommentCount,
            details: activeComments
          } : null,
          timestamp: new Date().toISOString()
        };

        // Add prominent admin reply message if present
        if (adminReplies.length > 0) {
          baseResult._PRIORITY_MESSAGE = `📬 ADMIN REPLY TO YOUR SUPPORT TICKET:\n\nTicket: "${adminReplies[0].subject}"\nAdmin Response: "${adminReplies[0].adminReply}"\nStatus: ${adminReplies[0].status}\n\n⚠️ DISPLAY THIS MESSAGE TO THE USER BEFORE ANYTHING ELSE.`;
          baseResult.adminReplies = adminReplies;
        }

        // Add admin messages (broadcasts and direct messages) if present
        if (hasAdminMessages) {
          let priorityMsg = baseResult._PRIORITY_MESSAGE || '';

          // Format broadcasts
          if (adminMessages.broadcasts.length > 0) {
            priorityMsg += '\n\n📢 ANNOUNCEMENTS:\n';
            for (const b of adminMessages.broadcasts) {
              priorityMsg += `\n[${b.priority === 'urgent' ? '🚨 URGENT' : 'Announcement'}] ${b.title}\n`;
              priorityMsg += `${b.body}\n`;
              priorityMsg += `(Dismiss with: dismiss_admin_message("${b.id}", "broadcast"))\n`;
            }
          }

          // Format direct messages
          if (adminMessages.directMessages.length > 0) {
            priorityMsg += '\n\n💬 DIRECT MESSAGES FROM ADMIN:\n';
            for (const dm of adminMessages.directMessages) {
              priorityMsg += `\n[Thread: ${dm.subject}]\n`;
              priorityMsg += `"${dm.latestMessage.body}"\n`;
              priorityMsg += `(Reply with: reply_to_admin("${dm.threadId}", "your message") or dismiss with: dismiss_admin_message("${dm.threadId}", "thread"))\n`;
            }
          }

          baseResult._PRIORITY_MESSAGE = priorityMsg;
          baseResult.adminMessages = adminMessages;
        }

        resultContent = baseResult;
      }
      else if (name === "list_trips") {
        const list = await env.TRIPS.list({ prefix: keyPrefix });
        const trips = list.keys
          .map(k => k.name.replace(keyPrefix, ''))
          .filter(k => !k.startsWith("_"));

        // Also check for admin replies (in case get_context wasn't called first)
        const userId = keyPrefix.replace(/\/$/, '');
        const supportData = await env.TRIPS.get("_support_requests", "json") as { requests: any[] } | null;
        const adminReplies: any[] = [];

        if (supportData?.requests) {
          for (const ticket of supportData.requests) {
            if (ticket.userId === userId && ticket.adminNotes && !ticket.adminNotesSeen) {
              adminReplies.push({
                ticketId: ticket.id,
                subject: ticket.subject,
                adminReply: ticket.adminNotes,
                status: ticket.status
              });
            }
          }

          // Mark as seen
          if (adminReplies.length > 0) {
            for (const ticket of supportData.requests) {
              if (ticket.userId === userId && ticket.adminNotes && !ticket.adminNotesSeen) {
                ticket.adminNotesSeen = true;
              }
            }
            await env.TRIPS.put("_support_requests", JSON.stringify(supportData));
          }
        }

        if (adminReplies.length > 0) {
          resultContent = {
            _PRIORITY_MESSAGE: `📬 ADMIN REPLY TO YOUR SUPPORT TICKET:\n\nTicket: "${adminReplies[0].subject}"\nAdmin Response: "${adminReplies[0].adminReply}"\nStatus: ${adminReplies[0].status}\n\n⚠️ DISPLAY THIS MESSAGE TO THE USER BEFORE ANYTHING ELSE.`,
            adminReplies,
            trips
          };
        } else {
          resultContent = trips;
        }
      }
      else if (name === "read_trip") {
        const tripId = args.key;
        const fullKey = tripId.startsWith("_") ? keyPrefix + tripId : keyPrefix + tripId;
        const data = await env.TRIPS.get(fullKey, "json");
        if (!data) throw new Error(`Trip '${tripId}' not found.`);

        // Check for active (non-dismissed) comments
        const commentsKey = `${keyPrefix}${tripId}/_comments`;
        const commentsData = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;
        const activeComments = commentsData?.comments?.filter(c => !c.dismissed) || [];

        if (activeComments.length > 0) {
          resultContent = {
            _activeComments: {
              count: activeComments.length,
              instruction: `🚨 This trip has ${activeComments.length} active client comment(s). Display them prominently. Use dismiss_comments('${tripId}') when user acknowledges.`,
              comments: activeComments.map(c => ({
                id: c.id,
                section: c.section,
                item: c.item,
                message: c.message,
                name: c.name || 'Anonymous',
                email: c.email,
                timestamp: c.timestamp
              }))
            },
            ...data as object
          };
        } else {
          resultContent = data;
        }
      }
      else if (name === "save_trip") {
        const fullKey = keyPrefix + args.key;
        await env.TRIPS.put(fullKey, JSON.stringify(args.data));

        // Auto-update activity log on every save
        const activityLogKey = keyPrefix + "_activity-log";
        const activityLog = await env.TRIPS.get(activityLogKey, "json") as any || {
          lastSession: null,
          recentChanges: [],
          openItems: [],
          tripsActive: []
        };

        // Extract change description from trip meta if available
        const tripData = args.data as any;
        const changeDescription = tripData?.meta?.status || "Updated";
        const tripName = tripData?.meta?.clientName || tripData?.meta?.destination || args.key;

        // Add to recent changes (prepend, newest first)
        activityLog.recentChanges.unshift({
          tripId: args.key,
          tripName,
          change: changeDescription,
          timestamp: new Date().toISOString()
        });

        // Keep only last 20 changes to prevent unbounded growth
        if (activityLog.recentChanges.length > 20) {
          activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
        }

        // Update last session timestamp
        activityLog.lastSession = new Date().toISOString();

        // Add trip to active list if not already present (O(1) vs O(n) list scan)
        if (!activityLog.tripsActive.includes(args.key)) {
          activityLog.tripsActive.push(args.key);
        }

        await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));

        resultContent = `Successfully saved ${args.key}`;
      }
      else if (name === "patch_trip") {
        // Read existing trip
        const fullKey = keyPrefix + args.key;
        const existingData = await env.TRIPS.get(fullKey, "json") as any;
        if (!existingData) throw new Error(`Trip '${args.key}' not found.`);

        // Apply updates using dot-notation paths
        const updates = args.updates as Record<string, any>;
        const updatedFields: string[] = [];

        for (const [path, value] of Object.entries(updates)) {
          const parts = path.split('.');
          let current = existingData;

          // Navigate to parent of target field
          for (let i = 0; i < parts.length - 1; i++) {
            if (current[parts[i]] === undefined) {
              current[parts[i]] = {};
            }
            current = current[parts[i]];
          }

          // Set the value
          const lastPart = parts[parts.length - 1];
          current[lastPart] = value;
          updatedFields.push(path);
        }

        // Update lastUpdated timestamp
        if (existingData.meta) {
          existingData.meta.lastUpdated = new Date().toISOString();
        }

        // Save updated trip
        await env.TRIPS.put(fullKey, JSON.stringify(existingData));

        // Update activity log
        const activityLogKey = keyPrefix + "_activity-log";
        const activityLog = await env.TRIPS.get(activityLogKey, "json") as any || {
          lastSession: null,
          recentChanges: [],
          openItems: [],
          tripsActive: []
        };

        const changeDescription = existingData?.meta?.status || `Updated: ${updatedFields.join(', ')}`;
        const tripName = existingData?.meta?.clientName || existingData?.meta?.destination || args.key;

        activityLog.recentChanges.unshift({
          tripId: args.key,
          tripName,
          change: changeDescription,
          timestamp: new Date().toISOString()
        });

        if (activityLog.recentChanges.length > 20) {
          activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
        }

        activityLog.lastSession = new Date().toISOString();
        await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));

        resultContent = `Patched ${args.key}: updated ${updatedFields.join(', ')}`;
      }
      else if (name === "delete_trip") {
        const fullKey = keyPrefix + args.key;
        await env.TRIPS.delete(fullKey);

        // Update activity log - remove from active trips list
        const activityLogKey = keyPrefix + "_activity-log";
        const activityLog = await env.TRIPS.get(activityLogKey, "json") as any;
        if (activityLog?.tripsActive) {
          activityLog.tripsActive = activityLog.tripsActive.filter((t: string) => t !== args.key);
          activityLog.recentChanges.unshift({
            tripId: args.key,
            tripName: args.key,
            change: "Deleted",
            timestamp: new Date().toISOString()
          });
          if (activityLog.recentChanges.length > 20) {
            activityLog.recentChanges = activityLog.recentChanges.slice(0, 20);
          }
          activityLog.lastSession = new Date().toISOString();
          await env.TRIPS.put(activityLogKey, JSON.stringify(activityLog));
        }

        // Also remove from comment index if present
        await removeFromCommentIndex(env, keyPrefix, args.key);

        resultContent = `Deleted ${args.key}`;
      }
      else if (name === "list_templates") {
        // List templates from KV + built-in default
        const templateKeys = await env.TRIPS.list({ prefix: "_templates/" });
        const templates = ["default"];  // Built-in default always available

        for (const key of templateKeys.keys) {
          const templateName = key.name.replace("_templates/", "");
          if (templateName && !templates.includes(templateName)) {
            templates.push(templateName);
          }
        }

        resultContent = {
          templates,
          note: "Use template name with preview_publish or publish_trip"
        };
      }
      else if (name === "preview_publish") {
        const { tripId, template = "default" } = args;

        // Check GitHub config
        if (!env.GITHUB_TOKEN) throw new Error("GitHub token not configured. Run: wrangler secret put GITHUB_TOKEN");
        if (!env.GITHUB_REPO) throw new Error("GitHub repo not configured in wrangler.toml");

        // Read trip data
        const fullKey = keyPrefix + tripId;
        const tripData = await env.TRIPS.get(fullKey, "json");
        if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

        // Render using shared template renderer
        const html = await renderTripHtml(env, tripData, template, userProfile, fullKey);

        // Publish to drafts/ folder for preview
        const draftFilename = `drafts/${tripId}.html`;
        const previewUrl = await publishDraftToGitHub(env, draftFilename, html);

        resultContent = {
          previewUrl,
          tripId,
          template,
          message: `Preview ready! View at ${previewUrl}`,
          note: "This is a draft preview. When ready, use publish_trip to publish to the main site.",
          cacheNote: "GitHub Pages may take up to 1 minute to update. If you don't see the latest changes, use hard refresh (Ctrl+Shift+R or Cmd+Shift+R)."
        };
      }
      else if (name === "publish_trip") {
        const { tripId, template = "default", filename, category = "testing" } = args;
        const outputFilename = (filename || tripId).replace(/\.html$/, "") + ".html";

        // Check subscription status and limits
        if (userProfile?.subscription) {
          const sub = userProfile.subscription;

          // Check subscription is active or trialing
          if (sub.status !== 'active' && sub.status !== 'trialing') {
            if (sub.status === 'past_due') {
              // Give 7-day grace period for past_due
              const gracePeriodEnd = new Date(sub.currentPeriodEnd);
              gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
              if (new Date() > gracePeriodEnd) {
                throw new Error("Your subscription payment failed. Please update your payment method at /subscribe to continue publishing.");
              }
              // Warn but allow during grace period
              resultContent = { _warning: "Payment issue detected. Please update your payment method to avoid service interruption." };
            } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
              throw new Error("Your subscription is inactive. Please visit /subscribe to reactivate your account.");
            }
          }

          // Check publish limit (skip if unlimited or legacy user)
          if (sub.publishLimit !== -1 && sub.publishLimit > 0) {
            const userId = keyPrefix.replace(/\/$/, '');
            const usage = await getMonthlyUsage(env, userId);
            if (usage.publishCount >= sub.publishLimit) {
              const nextMonth = new Date();
              nextMonth.setMonth(nextMonth.getMonth() + 1);
              nextMonth.setDate(1);
              throw new Error(`You've reached your monthly limit of ${sub.publishLimit} proposals. Upgrade your plan at /subscribe or wait until ${nextMonth.toLocaleDateString()}.`);
            }
          }
        }
        // Note: Users without subscription data (legacy users) can still publish
        // This maintains backward compatibility during transition period

        // Check GitHub config
        if (!env.GITHUB_TOKEN) throw new Error("GitHub token not configured. Run: wrangler secret put GITHUB_TOKEN");
        if (!env.GITHUB_REPO) throw new Error("GitHub repo not configured in wrangler.toml");

        // Read trip data
        const fullKey = keyPrefix + tripId;
        const tripData = await env.TRIPS.get(fullKey, "json") as any;
        if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

        // Render using shared template renderer
        const html = await renderTripHtml(env, tripData, template, userProfile, fullKey);

        // Publish to GitHub
        const publicUrl = await publishToGitHub(env, outputFilename, html, {
          title: tripData.meta?.clientName || tripData.meta?.destination || tripId,
          dates: tripData.meta?.dates || tripData.dates?.start || "",
          destination: tripData.meta?.destination || "",
          category: category
        });

        // Increment publish count for subscription tracking
        let usageInfo: { publishesUsed?: number; publishLimit?: number; remaining?: number } = {};
        if (userProfile?.subscription && userProfile.subscription.publishLimit !== 0) {
          const userId = keyPrefix.replace(/\/$/, '');
          const usage = await incrementPublishCount(env, userId, tripId, outputFilename);
          usageInfo = {
            publishesUsed: usage.publishCount,
            publishLimit: userProfile.subscription.publishLimit,
            remaining: userProfile.subscription.publishLimit === -1 ? -1 : userProfile.subscription.publishLimit - usage.publishCount
          };
        }

        resultContent = {
          success: true,
          url: publicUrl,
          filename: outputFilename,
          tripId,
          template,
          message: `Published! View at ${publicUrl}`,
          cacheNote: "GitHub Pages may take up to 1 minute to update. If you don't see the latest changes, use hard refresh (Ctrl+Shift+R or Cmd+Shift+R).",
          ...(Object.keys(usageInfo).length > 0 && { usage: usageInfo })
        };
      }
      else if (name === "validate_trip") {
        const { tripId } = args;

        // Read trip data
        const fullKey = keyPrefix + tripId;
        const tripData = await env.TRIPS.get(fullKey, "json");
        if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

        // Load instruction from KV or use simple fallback
        let instruction = await env.TRIPS.get("_prompts/validate-trip", "text");
        if (!instruction) {
          instruction = "Analyze this trip for logistics issues, missing information, and data quality. Report Critical Issues, Warnings, Suggestions, and Trip Strengths.";
        }

        resultContent = {
          tripId,
          tripData,
          _instruction: instruction
        };
      }
      else if (name === "import_quote") {
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

        resultContent = {
          tripId,
          tripData,
          quoteText,
          quoteType,
          _instruction: instruction
        };
      }
      else if (name === "analyze_profitability") {
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

        resultContent = {
          tripId,
          tripData,
          targetCommission: targetCommission || null,
          _instruction: instruction
        };
      }
      else if (name === "get_prompt") {
        const { name: promptName } = args;

        // Load the requested prompt from KV
        const promptKey = `_prompts/${promptName}`;
        const promptContent = await env.TRIPS.get(promptKey, "text");

        if (!promptContent) {
          throw new Error(`Prompt '${promptName}' not found. Available prompts: cruise-instructions, handle-changes, research-destination, validate-trip, import-quote, analyze-profitability`);
        }

        resultContent = {
          promptName,
          content: promptContent,
          _note: "Use this guidance for the current task. The instructions above are specialized for this scenario."
        };
      }
      else if (name === "get_comments") {
        const { tripId, markAsRead = true } = args;

        // Read comments
        const commentsKey = `${keyPrefix}${tripId}/_comments`;
        const data = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;
        const comments = data?.comments || [];

        if (comments.length === 0) {
          resultContent = `No comments for trip '${tripId}'.`;
        } else {
          // Mark as read if requested
          if (markAsRead && comments.some(c => !c.read)) {
            const updatedComments = comments.map(c => ({ ...c, read: true }));
            await env.TRIPS.put(commentsKey, JSON.stringify({ comments: updatedComments }));
          }

          // Format comments for display
          const unreadCount = comments.filter(c => !c.read).length;
          let output = `📬 Comments for ${tripId}`;
          if (unreadCount > 0) output += ` (${unreadCount} new)`;
          output += '\n\n';

          comments.forEach((c, i) => {
            const isNew = !c.read ? '🆕 ' : '';
            const time = new Date(c.timestamp).toLocaleString();
            const section = c.item ? `${c.section} - ${c.item}` : c.section;
            output += `${isNew}[${section}] ${c.name} - ${time}\n`;
            output += `"${c.message}"\n`;
            if (c.email) output += `Reply to: ${c.email}\n`;
            output += '\n';
          });

          resultContent = output;
        }
      }
      else if (name === "get_all_comments") {
        // List all trips and check for comments
        const trips = await env.TRIPS.list({ prefix: keyPrefix });
        const allComments: { tripId: string; comments: any[] }[] = [];

        for (const key of trips.keys) {
          // Skip non-trip keys
          if (key.name.includes('/_') || key.name.startsWith(keyPrefix + '_')) continue;

          // Check for comments
          const tripId = key.name.replace(keyPrefix, '');
          const commentsKey = `${key.name}/_comments`;
          const data = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;

          if (data?.comments?.length) {
            const unreadComments = data.comments.filter(c => !c.read);
            if (unreadComments.length > 0) {
              allComments.push({ tripId, comments: unreadComments });
            }
          }
        }

        if (allComments.length === 0) {
          resultContent = "No new comments across any trips.";
        } else {
          let output = `📬 New Comments Across All Trips\n\n`;
          let totalNew = 0;

          allComments.forEach(({ tripId, comments }) => {
            totalNew += comments.length;
            output += `**${tripId}** (${comments.length} new)\n`;
            comments.slice(0, 3).forEach(c => {
              const time = new Date(c.timestamp).toLocaleString();
              const section = c.item ? `${c.section} - ${c.item}` : c.section;
              output += `  [${section}] "${c.message.slice(0, 50)}${c.message.length > 50 ? '...' : ''}"\n`;
            });
            if (comments.length > 3) {
              output += `  ... and ${comments.length - 3} more\n`;
            }
            output += '\n';
          });

          output += `\nTotal: ${totalNew} new comments across ${allComments.length} trips.\n`;
          output += `Use 'get_comments' on a specific trip to see full details and mark as read.`;

          resultContent = output;
        }
      }
      else if (name === "dismiss_comments") {
        const { tripId, commentIds } = args;
        const commentsKey = `${keyPrefix}${tripId}/_comments`;
        const data = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;

        if (!data?.comments?.length) {
          resultContent = `No comments found for trip '${tripId}'.`;
        } else {
          let dismissedCount = 0;
          const updatedComments = data.comments.map(c => {
            // Dismiss specific comments or all if no IDs provided
            if (!commentIds || commentIds.includes(c.id)) {
              if (!c.dismissed) {
                dismissedCount++;
                return { ...c, dismissed: true };
              }
            }
            return c;
          });

          await env.TRIPS.put(commentsKey, JSON.stringify({ comments: updatedComments }));

          // Update comment index - remove trip if no more active comments
          const hasActiveComments = updatedComments.some(c => !c.dismissed);
          if (!hasActiveComments) {
            await removeFromCommentIndex(env, keyPrefix, tripId);
          }

          resultContent = `✓ Dismissed ${dismissedCount} comment(s) for trip '${tripId}'. They will no longer appear in session start.`;
        }
      }
      else if (name === "submit_support") {
        const { subject, message, priority = "medium", tripId, screenshotUrl } = args;

        // Get or create support requests list
        const supportKey = "_support_requests";
        const existing = await env.TRIPS.get(supportKey, "json") as { requests: any[] } | null;
        const requests = existing?.requests || [];

        // Create support ticket
        const ticketId = `support_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const ticket: any = {
          id: ticketId,
          userId: keyPrefix.slice(0, -1),
          subject,
          message,
          priority,
          tripId: tripId || null,
          status: "open",
          timestamp: new Date().toISOString()
        };

        // Store screenshot URL if provided
        if (screenshotUrl) {
          ticket.screenshotUrl = screenshotUrl;
        }

        requests.unshift(ticket); // Add to beginning (newest first)

        // Keep last 100 requests
        if (requests.length > 100) {
          requests.length = 100;
        }

        await env.TRIPS.put(supportKey, JSON.stringify({ requests }));

        resultContent = {
          success: true,
          ticketId: ticket.id,
          message: `✓ Support request submitted! Ticket ID: ${ticket.id}. An admin will review your request soon.`
        };
      }
      else if (name === "reply_to_admin") {
        const { threadId, message } = args;
        const userId = keyPrefix.slice(0, -1);

        // Load user's threads
        const threadsKey = `_admin_messages/threads/${userId}`;
        const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;

        if (!threadsData?.threads) {
          throw new Error("No message threads found. You may not have any messages from admin.");
        }

        const thread = threadsData.threads.find(t => t.id === threadId);
        if (!thread) {
          throw new Error(`Thread '${threadId}' not found. Check the threadId from adminMessages in get_context.`);
        }

        // Add user's reply
        const newMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sender: "user",
          senderName: userProfile?.name || userId,
          body: message,
          timestamp: new Date().toISOString(),
          read: false  // Admin hasn't seen it yet
        };

        thread.messages.push(newMessage);
        thread.updatedAt = new Date().toISOString();
        thread.status = "open";  // Re-open if was closed

        // Mark admin messages as read since user is replying
        for (const msg of thread.messages) {
          if (msg.sender === "admin") {
            msg.read = true;
          }
        }

        await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));

        resultContent = {
          success: true,
          message: `✓ Reply sent to admin. Thread: "${thread.subject}". The admin will be notified of your response.`
        };
      }
      else if (name === "dismiss_admin_message") {
        const { messageId, type } = args;
        const userId = keyPrefix.slice(0, -1);

        if (type === "broadcast") {
          // Add to user's dismissed broadcasts list
          const stateKey = `_admin_messages/user_states/${userId}`;
          const state = await env.TRIPS.get(stateKey, "json") as {
            dismissedBroadcasts: string[];
            lastChecked: string;
          } | null || { dismissedBroadcasts: [], lastChecked: new Date().toISOString() };

          if (!state.dismissedBroadcasts.includes(messageId)) {
            state.dismissedBroadcasts.push(messageId);
          }
          state.lastChecked = new Date().toISOString();

          await env.TRIPS.put(stateKey, JSON.stringify(state));

          resultContent = {
            success: true,
            message: `✓ Announcement dismissed. It won't appear again.`
          };
        } else if (type === "thread") {
          // Mark all messages in thread as read
          const threadsKey = `_admin_messages/threads/${userId}`;
          const threadsData = await env.TRIPS.get(threadsKey, "json") as { threads: any[] } | null;

          if (threadsData?.threads) {
            const thread = threadsData.threads.find(t => t.id === messageId);
            if (thread) {
              for (const msg of thread.messages) {
                msg.read = true;
              }
              thread.updatedAt = new Date().toISOString();
              await env.TRIPS.put(threadsKey, JSON.stringify(threadsData));
            }
          }

          resultContent = {
            success: true,
            message: `✓ Message thread marked as read. You can still reply later using reply_to_admin if needed.`
          };
        } else {
          throw new Error("Invalid type. Use 'broadcast' for announcements or 'thread' for direct messages.");
        }
      }
      else if (name === "add_trip_image") {
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
          }

          // Store in images object (legacy)
          if (!tripData.images.lodging[actualItemName]) tripData.images.lodging[actualItemName] = [];
          tripData.images.lodging[actualItemName].push(imageEntry);

          // Also store directly on the lodging item for template rendering
          if (tripData.lodging && Array.isArray(tripData.lodging)) {
            const lodgingItem = tripData.lodging.find((l: any) => l.name === actualItemName);
            if (lodgingItem) {
              if (!lodgingItem.images) lodgingItem.images = [];
              lodgingItem.images.push(imageEntry);
            }
          }
        } else if (target === "activity") {
          if (!itemName) throw new Error("itemName required for activity images (activity name)");

          // Find the actual activity name from trip data
          const allActivities = tripData.itinerary?.flatMap((day: any) => day.activities || []) || [];
          const matchedName = findBestMatch(itemName, allActivities);
          if (matchedName) {
            actualItemName = matchedName;
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

        resultContent = {
          success: true,
          target,
          itemName: actualItemName || null,
          requestedName: itemName !== actualItemName ? itemName : undefined,
          urls: uploadResult.urls,
          message: `✓ Image added to ${target}${actualItemName ? ` (${actualItemName})` : ''} for trip '${tripId}'.${itemName !== actualItemName ? ` (matched from '${itemName}')` : ''}`
        };
      }
      else if (name === "prepare_image_upload") {
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

        resultContent = {
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
      }
      else if (name === "youtube_search") {
        const { query, maxResults = 5 } = args;

        if (!query) {
          throw new Error("query is required");
        }

        const limit = Math.min(Math.max(1, maxResults), 10);

        // Step 1: Search for videos
        const searchParams = new URLSearchParams({
          part: 'snippet',
          q: query,
          type: 'video',
          maxResults: String(limit),
          relevanceLanguage: 'en',
          safeSearch: 'moderate',
          key: env.YOUTUBE_API_KEY
        });

        const searchResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`
        );

        if (!searchResponse.ok) {
          const errorData = await searchResponse.json() as any;
          throw new Error(`YouTube API error: ${errorData.error?.message || searchResponse.statusText}`);
        }

        const searchData = await searchResponse.json() as {
          items: Array<{
            id: { videoId: string };
            snippet: {
              title: string;
              description: string;
              channelTitle: string;
              publishedAt: string;
              thumbnails: { medium?: { url: string } };
            };
          }>;
        };

        if (!searchData.items?.length) {
          resultContent = {
            videos: [],
            message: "No videos found for this query. Try different search terms."
          };
        } else {
          // Step 2: Get video statistics (view counts, etc.)
          const videoIds = searchData.items.map(item => item.id.videoId).join(',');

          const statsParams = new URLSearchParams({
            part: 'statistics,contentDetails',
            id: videoIds,
            key: env.YOUTUBE_API_KEY
          });

          const statsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${statsParams.toString()}`
          );

          let statsMap: Record<string, { viewCount: string; likeCount: string; duration: string }> = {};

          if (statsResponse.ok) {
            const statsData = await statsResponse.json() as {
              items: Array<{
                id: string;
                statistics: { viewCount: string; likeCount: string };
                contentDetails: { duration: string };
              }>;
            };

            for (const item of statsData.items) {
              statsMap[item.id] = {
                viewCount: item.statistics.viewCount,
                likeCount: item.statistics.likeCount,
                duration: item.contentDetails.duration
              };
            }
          }

          // Parse ISO 8601 duration (PT#M#S) to human readable
          const parseDuration = (iso: string): string => {
            const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!match) return iso;
            const hours = match[1] ? `${match[1]}:` : '';
            const mins = match[2] || '0';
            const secs = match[3]?.padStart(2, '0') || '00';
            return hours ? `${hours}${mins.padStart(2, '0')}:${secs}` : `${mins}:${secs}`;
          };

          // Format view count
          const formatViews = (views: string): string => {
            const num = parseInt(views, 10);
            if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
            if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
            return views;
          };

          // Build results sorted by view count
          const videos = searchData.items
            .map(item => {
              const stats = statsMap[item.id.videoId];
              return {
                id: item.id.videoId,
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                publishedAt: item.snippet.publishedAt.split('T')[0],
                viewCount: stats?.viewCount ? parseInt(stats.viewCount, 10) : 0,
                viewCountFormatted: stats?.viewCount ? formatViews(stats.viewCount) : 'N/A',
                likeCount: stats?.likeCount ? formatViews(stats.likeCount) : 'N/A',
                duration: stats?.duration ? parseDuration(stats.duration) : 'N/A',
                thumbnail: item.snippet.thumbnails.medium?.url || null,
                url: `https://www.youtube.com/watch?v=${item.id.videoId}`
              };
            })
            .sort((a, b) => b.viewCount - a.viewCount);

          resultContent = {
            videos,
            query,
            _usage: "Add videos to trips using the 'media' array (general) or 'itinerary[].videos' (day-specific). Format: { id: 'VIDEO_ID', caption: 'Description' }"
          };
        }
      }
      else {
        throw new Error(`Unknown tool: ${name}`);
      }

      return {
        jsonrpc: "2.0",
        id: req.id!,
        result: {
          content: [{ type: "text", text: typeof resultContent === 'string' ? resultContent : JSON.stringify(resultContent, null, 2) }],
          isError: false
        }
      };

    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id: req.id!,
        result: {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true
        }
      };
    }
  }

  // Fallback
  return {
    jsonrpc: "2.0",
    error: { code: -32601, message: "Method not found" },
    id: req.id!
  };
}

/**
 * Publish HTML file to GitHub and update trips.json metadata
 */
async function publishToGitHub(
  env: Env,
  filename: string,
  htmlContent: string,
  tripMeta: { title: string; dates: string; destination: string; category: string }
): Promise<string> {
  const baseUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents`;
  const headers = {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Voygent-MCP',
    'Accept': 'application/vnd.github.v3+json'
  };

  // 1. Check if HTML file exists (to get SHA for update)
  let htmlSha: string | null = null;
  const checkUrl = `${baseUrl}/${filename}?ref=main`;
  const checkResponse = await fetch(checkUrl, { headers });
  if (checkResponse.ok) {
    const existing = await checkResponse.json() as any;
    htmlSha = existing.sha;
  } else if (checkResponse.status !== 404) {
    // Unexpected error checking file existence
    const errorText = await checkResponse.text();
    console.error(`Error checking file ${filename}: ${checkResponse.status} - ${errorText}`);
  }
  // 404 = file doesn't exist, that's fine (will create new)

  // 2. Upload/Update HTML file
  const htmlPayload = {
    message: htmlSha ? `Update trip: ${filename}` : `Add trip: ${filename}`,
    content: toBase64(htmlContent),
    branch: 'main',
    ...(htmlSha ? { sha: htmlSha } : {})
  };

  const htmlResponse = await fetch(`${baseUrl}/${filename}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(htmlPayload)
  });

  if (!htmlResponse.ok) {
    const error = await htmlResponse.text();
    throw new Error(`Failed to upload HTML ${filename} (sha: ${htmlSha || 'none'}): ${error}`);
  }

  // 3. Get current trips.json
  let tripsJson: any = { version: 1, trips: [] };
  let tripsSha: string | null = null;

  const tripsResponse = await fetch(`${baseUrl}/trips.json?ref=main`, { headers });
  if (tripsResponse.ok) {
    const tripsData = await tripsResponse.json() as any;
    tripsSha = tripsData.sha;
    // Decode base64 content
    const content = atob(tripsData.content.replace(/\n/g, ''));
    tripsJson = JSON.parse(content);
  } else if (tripsResponse.status !== 404) {
    // Unexpected error getting trips.json
    const errorText = await tripsResponse.text();
    console.error(`Error getting trips.json: ${tripsResponse.status} - ${errorText}`);
  }
  // 404 = trips.json doesn't exist, start fresh

  // 4. Update trips.json with new/updated entry
  const existingIndex = tripsJson.trips.findIndex((t: any) => t.filename === filename);
  const tripEntry = {
    filename,
    title: tripMeta.title,
    dates: tripMeta.dates,
    category: tripMeta.category,
    tags: tripMeta.destination ? [tripMeta.destination] : [],
    lastModified: new Date().toISOString().split('T')[0]
  };

  if (existingIndex >= 0) {
    tripsJson.trips[existingIndex] = tripEntry;
  } else {
    tripsJson.trips.unshift(tripEntry);  // Add to beginning
  }

  // 5. Save updated trips.json
  const tripsPayload = {
    message: `Update trips.json for ${filename}`,
    content: toBase64(JSON.stringify(tripsJson, null, 2)),
    branch: 'main',
    ...(tripsSha ? { sha: tripsSha } : {})
  };

  const tripsUpdateResponse = await fetch(`${baseUrl}/trips.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(tripsPayload)
  });

  if (!tripsUpdateResponse.ok) {
    const error = await tripsUpdateResponse.text();
    throw new Error(`Failed to update trips.json (sha: ${tripsSha || 'none'}): ${error}`);
  }

  // Return public URL
  return `${SITE_BASE_URL}/${filename}`;
}

/**
 * Publish HTML file to GitHub drafts/ folder for preview (doesn't update trips.json)
 */
async function publishDraftToGitHub(
  env: Env,
  filename: string,
  htmlContent: string
): Promise<string> {
  const baseUrl = `https://api.github.com/repos/${env.GITHUB_REPO}/contents`;
  const headers = {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'Content-Type': 'application/json',
    'User-Agent': 'Voygent-MCP',
    'Accept': 'application/vnd.github.v3+json'
  };

  // Check if file exists (to get SHA for update)
  let fileSha: string | null = null;
  try {
    const checkResponse = await fetch(`${baseUrl}/${filename}?ref=main`, { headers });
    if (checkResponse.ok) {
      const existing = await checkResponse.json() as any;
      fileSha = existing.sha;
    }
  } catch (_) {
    // File doesn't exist, that's fine
  }

  // Upload/Update HTML file
  const payload = {
    message: fileSha ? `Update draft: ${filename}` : `Add draft: ${filename}`,
    content: toBase64(htmlContent),
    branch: 'main',
    ...(fileSha ? { sha: fileSha } : {})
  };

  const response = await fetch(`${baseUrl}/${filename}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload draft: ${error}`);
  }

  // Return public URL
  return `${SITE_BASE_URL}/${filename}`;
}
