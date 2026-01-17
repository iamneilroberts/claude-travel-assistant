/**
 * Stripe webhook handler
 */

import type { Env, UserProfile, RouteHandler } from '../types';
import { verifyStripeSignature, findUserByStripeCustomerId } from '../lib/stripe';
import { generateTrialSubdomain, getUserSubdomain, setSubdomainOwner } from '../lib/subdomain';

export const handleStripeWebhook: RouteHandler = async (request, env, ctx, url, corsHeaders) => {
  if (url.pathname !== "/webhook/stripe" || request.method !== "POST") {
    return null;
  }

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

  // SECURITY: Idempotency check - prevent double-processing of events
  // Check if this event was already processed before doing anything
  //
  // KNOWN LIMITATION (TOCTOU Race Condition):
  // There's a time-of-check-to-time-of-use race between reading the event status
  // and writing the "processing" marker. Two concurrent webhook deliveries could
  // both pass this check before either writes the marker.
  //
  // In practice, Stripe typically spaces out webhook retries, making collision unlikely.
  // The operations are also idempotent (updating subscription status to same value).
  //
  // PROPER FIX: Use Cloudflare Durable Objects for atomic compare-and-swap, or
  // use a database with conditional writes (e.g., D1 with WHERE processed = false).
  // This would require architectural changes beyond the scope of the current fix.
  //
  const existingEvent = await env.TRIPS.get(`_stripe_events/${event.id}`, "json") as {
    type: string;
    timestamp: string;
    processed: boolean;
    processedAt?: string;
  } | null;

  if (existingEvent?.processed) {
    // Event already processed - return success but don't reprocess
    console.log(`Stripe webhook: Event ${event.id} already processed at ${existingEvent.processedAt}, skipping`);
    return new Response(JSON.stringify({
      received: true,
      skipped: true,
      reason: "Event already processed"
    }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  // Log event for audit (mark as being processed)
  await env.TRIPS.put(`_stripe_events/${event.id}`, JSON.stringify({
    type: event.type,
    timestamp: new Date().toISOString(),
    processed: false,
    processing: true,  // Mark as currently being processed
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
          const price = subscription.items.data[0].price;
          const lookupKey = price.lookup_key || price.nickname || price.id;
          const metadataTier = price.metadata?.tier;
          const metadataLimit = price.metadata?.publish_limit;
          let tierName = metadataTier || 'starter';
          let publishLimit = 10;

          if (metadataLimit !== undefined && metadataLimit !== '') {
            const parsedLimit = parseInt(metadataLimit, 10);
            if (!Number.isNaN(parsedLimit)) {
              publishLimit = parsedLimit;
            }
          } else {
            const tierHint = metadataTier || lookupKey;
            if (tierHint.includes('professional')) {
              tierName = metadataTier || 'professional';
              publishLimit = 50;
            } else if (tierHint.includes('agency')) {
              tierName = metadataTier || 'agency';
              publishLimit = -1; // unlimited
            } else if (tierHint.includes('starter')) {
              tierName = metadataTier || 'starter';
              publishLimit = 10;
            }
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

          // Assign subdomain if user doesn't have one
          const existingSubdomain = await getUserSubdomain(env, user.userId);
          if (!existingSubdomain) {
            const newSubdomain = generateTrialSubdomain(user.userId);
            await setSubdomainOwner(env, newSubdomain, user.userId);
            user.subdomain = newSubdomain;
          } else if (!user.subdomain) {
            // Ensure subdomain is on the user profile
            user.subdomain = existingSubdomain;
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

    // Mark event as processed with timestamp
    const eventLog = await env.TRIPS.get(`_stripe_events/${event.id}`, "json") as any;
    if (eventLog) {
      eventLog.processed = true;
      eventLog.processing = false;
      eventLog.processedAt = new Date().toISOString();
      await env.TRIPS.put(`_stripe_events/${event.id}`, JSON.stringify(eventLog));
    }

  } catch (err) {
    console.error("Webhook handler error:", err);
    // Don't return error - Stripe will retry
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" }
  });
};
