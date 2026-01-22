/**
 * MCP Tool Handlers: Publishing operations
 * Handles: list_templates, preview_publish, publish_trip
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';
import { listAllKeys } from '../../lib/kv';
import { publishToGitHub, publishDraftToGitHub } from '../../lib/github';
import { getMonthlyUsage, incrementPublishCount } from '../../lib/usage';
import { renderTripHtml, listAvailableTemplates, resolveTemplateName } from '../../template-renderer';
import { savePublishedTrip, saveDraftTrip } from '../../lib/published';
import { validateTripId, validateFilename } from '../../lib/validation';
import { analyzeOpenSlots } from '../../lib/slot-analysis';

/**
 * Extract the generation timestamp from rendered HTML
 * Looks for: <!-- voygent:generated:2026-01-22T20:00:13.322Z -->
 */
function extractGeneratedTimestamp(html: string): string | null {
  const match = html.match(/<!-- voygent:generated:([^\s]+)/);
  return match ? match[1].trim() : null;
}

/**
 * Verify published content by reading from R2 directly
 * This avoids worker-to-worker fetch issues
 */
async function verifyPublishedContent(
  env: Env,
  userId: string,
  filename: string,
  expectedTimestamp: string,
  folder: 'drafts' | 'published' = 'drafts'
): Promise<{ success: boolean; foundTimestamp: string | null }> {
  try {
    // Read directly from R2
    const r2Key = `${folder}/${userId}/${filename}`;
    const object = await env.MEDIA.get(r2Key);
    if (object) {
      const text = await object.text();
      const foundTimestamp = extractGeneratedTimestamp(text);
      return {
        success: foundTimestamp === expectedTimestamp,
        foundTimestamp
      };
    }
  } catch (err) {
    // R2 read failed
  }
  return { success: false, foundTimestamp: null };
}

export const handleListTemplates: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  // List both user-specific and system templates
  const templateInfo = await listAvailableTemplates(env, keyPrefix, listAllKeys);

  // Determine user's effective default template
  const userDefault = resolveTemplateName(undefined, userProfile);

  // Combine templates for display, marking user templates
  const allTemplates = [
    ...templateInfo.userTemplates.map(t => `${t} (your template)`),
    ...templateInfo.systemTemplates.map(t => t === userDefault ? `${t} (default)` : t)
  ];

  const result = {
    templates: allTemplates,
    userTemplates: templateInfo.userTemplates,
    systemTemplates: templateInfo.systemTemplates,
    currentDefault: userDefault,
    note: "User templates override system templates with the same name. Your templates are stored in your account.",
    hint: userProfile?.template
      ? `Your profile default is '${userProfile.template}'. Change it via admin settings.`
      : "No profile default set. Using system 'default' template."
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};

export const handlePreviewPublish: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, template } = args;

  // Security: Validate trip ID to prevent path traversal
  validateTripId(tripId);

  // Read trip data
  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json");
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  // Render using shared template renderer (resolves user default, checks user templates first)
  const html = await renderTripHtml(env, tripData, template, userProfile, fullKey, keyPrefix);

  // Previews always go to R2 for speed
  const userId = keyPrefix.replace(/\/$/, '');

  // User must have a subdomain for previews
  if (!userProfile?.subdomain) {
    throw new Error("No subdomain configured. Please contact support to set up your account.");
  }

  // Save to R2 drafts folder
  await saveDraftTrip(env, userId, tripId, html);

  // Preview URL is always subdomain (R2-served)
  const previewUrl = `https://${userProfile.subdomain}.voygent.ai/drafts/${tripId}.html`;

  // Extract timestamp from rendered HTML for verification
  const expectedTimestamp = extractGeneratedTimestamp(html);

  // Verify the content was saved to R2 correctly
  let verificationResult: { success: boolean; foundTimestamp: string | null } = { success: false, foundTimestamp: null };
  if (expectedTimestamp) {
    verificationResult = await verifyPublishedContent(env, userId, `${tripId}.html`, expectedTimestamp, 'drafts');
  }

  // Analyze open slots for profitability opportunities
  const openSlotAnalysis = analyzeOpenSlots(tripData, tripId);

  const result: any = {
    previewUrl,
    tripId,
    template,
    message: verificationResult.success
      ? `Preview ready! View at ${previewUrl}`
      : `Preview saved but verification failed - please check the URL`,
    note: "This is a draft preview. When ready, use publish_trip to publish to the main site.",
    verified: verificationResult.success,
    generatedAt: expectedTimestamp,
    _agentInstructions: verificationResult.success
      ? "The page is verified live. Simply share the URL with the user. Do NOT mention caching, hard refresh, or delays - the content is confirmed ready."
      : "Verification failed. Ask user to check the URL manually and try hard refresh if needed."
  };

  // Include open slot analysis for profitability check
  result.openSlotAnalysis = {
    summary: openSlotAnalysis.summary,
    daysWithOpportunity: openSlotAnalysis.daysWithOpportunity,
    days: openSlotAnalysis.days.filter(d => d.opportunity !== 'none').map(d => ({
      day: d.day,
      date: d.date,
      location: d.location,
      dayType: d.dayType,
      portHours: d.portHours,
      availableHours: d.availableHours,
      bookedCount: d.bookedActivities.length,
      opportunity: d.opportunity,
      suggestion: d.suggestion
    }))
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};

export const handlePublishTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, template, filename, category = "testing" } = args;

  // Security: Validate trip ID to prevent path traversal
  validateTripId(tripId);

  // Security: Validate filename if provided (prevents writing to arbitrary paths)
  if (filename) {
    validateFilename(filename);
  }

  const outputFilename = (filename || tripId).replace(/\.html$/, "") + ".html";

  // Check subscription status and limits
  let warningResult: any = null;
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
        warningResult = { _warning: "Payment issue detected. Please update your payment method to avoid service interruption." };
      } else if (sub.status === 'canceled' || sub.status === 'unpaid') {
        throw new Error("Your subscription is inactive. Please visit /subscribe to reactivate your account.");
      }
    }

    // Trial-specific checks
    if (sub.tier === 'trial') {
      const userId = keyPrefix.replace(/\/$/, '');
      const usage = await getMonthlyUsage(env, userId);

      // Trial limit: 1 published proposal
      if (usage.publishCount >= 1) {
        throw new Error("Trial accounts can publish 1 proposal. Upgrade to Pro for unlimited publishing at /subscribe");
      }

      // Trial users can only use default template
      if (template && template !== 'default') {
        throw new Error(`The '${template}' template is only available on Pro. Use the default template or upgrade at /subscribe`);
      }
    } else {
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
  }
  // Note: Users without subscription data (legacy users) can still publish
  // This maintains backward compatibility during transition period

  // Read trip data
  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json") as any;
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  // Render using shared template renderer (resolves user default, checks user templates first)
  const html = await renderTripHtml(env, tripData, template, userProfile, fullKey, keyPrefix);

  const userId = keyPrefix.replace(/\/$/, '');
  let primaryUrl: string;

  // Routing logic:
  // - customDomain users → GitHub Pages (custom domain DNS points there)
  // - All others → R2 only, served via subdomain.voygent.ai
  if (userProfile?.customDomain) {
    // Custom domain users need GitHub Pages for DNS
    if (!env.GITHUB_TOKEN) throw new Error("GitHub token not configured. Run: wrangler secret put GITHUB_TOKEN");
    if (!env.GITHUB_REPO) throw new Error("GitHub repo not configured in wrangler.toml");

    const publicUrl = await publishToGitHub(env, outputFilename, html, {
      title: tripData.meta?.clientName || tripData.meta?.destination || tripId,
      dates: tripData.meta?.dates || tripData.dates?.start || "",
      destination: tripData.meta?.destination || "",
      category: category
    });

    primaryUrl = `https://${userProfile.customDomain}/${outputFilename}`;

    // Also save to R2 as backup (non-blocking)
    try {
      await savePublishedTrip(env, userId, tripId, html, {
        filename: outputFilename,
        title: tripData.meta?.clientName || tripData.meta?.destination || tripId,
        destination: tripData.meta?.destination,
        category: category
      });
    } catch (err) {
      console.error('Failed to save to R2 (non-blocking):', err);
    }
  } else {
    // Standard users: R2 only, served via subdomain
    if (!userProfile?.subdomain) {
      throw new Error("No subdomain configured. Please contact support to set up your account.");
    }

    await savePublishedTrip(env, userId, tripId, html, {
      filename: outputFilename,
      title: tripData.meta?.clientName || tripData.meta?.destination || tripId,
      destination: tripData.meta?.destination,
      category: category
    });

    primaryUrl = `https://${userProfile.subdomain}.voygent.ai/trips/${outputFilename}`;
  }

  // Extract timestamp from rendered HTML for verification
  const expectedTimestamp = extractGeneratedTimestamp(html);

  // Verify the content was saved correctly (R2 is authoritative)
  let verificationResult: { success: boolean; foundTimestamp: string | null } = { success: false, foundTimestamp: null };
  if (expectedTimestamp) {
    verificationResult = await verifyPublishedContent(env, userId, outputFilename, expectedTimestamp, 'published');
  }

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

  const result = {
    success: true,
    url: primaryUrl,
    filename: outputFilename,
    tripId,
    template,
    message: verificationResult.success
      ? `Published! View at ${primaryUrl}`
      : `Published but verification failed - please check the URL`,
    verified: verificationResult.success,
    generatedAt: expectedTimestamp,
    _agentInstructions: verificationResult.success
      ? "The page is verified live. Simply share the URL with the user. Do NOT mention caching, hard refresh, or delays - the content is confirmed ready."
      : "Verification failed. Ask user to check the URL manually and try hard refresh if needed.",
    ...(warningResult || {}),
    ...(Object.keys(usageInfo).length > 0 && { usage: usageInfo })
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};
