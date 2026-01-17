/**
 * MCP Tool Handlers: Publishing operations
 * Handles: list_templates, preview_publish, publish_trip
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';
import { listAllKeys } from '../../lib/kv';
import { publishToGitHub, publishDraftToGitHub } from '../../lib/github';
import { getMonthlyUsage, incrementPublishCount } from '../../lib/usage';
import { renderTripHtml, listAvailableTemplates, resolveTemplateName } from '../../template-renderer';
import { savePublishedTrip } from '../../lib/published';

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

  // Check GitHub config
  if (!env.GITHUB_TOKEN) throw new Error("GitHub token not configured. Run: wrangler secret put GITHUB_TOKEN");
  if (!env.GITHUB_REPO) throw new Error("GitHub repo not configured in wrangler.toml");

  // Read trip data
  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json");
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  // Render using shared template renderer (resolves user default, checks user templates first)
  const html = await renderTripHtml(env, tripData, template, userProfile, fullKey, keyPrefix);

  // Publish to drafts/ folder for preview
  const draftFilename = `drafts/${tripId}.html`;
  const previewUrl = await publishDraftToGitHub(env, draftFilename, html);

  const result = {
    previewUrl,
    tripId,
    template,
    message: `Preview ready! View at ${previewUrl}`,
    note: "This is a draft preview. When ready, use publish_trip to publish to the main site.",
    cacheNote: "GitHub Pages may take up to 1 minute to update. If you don't see the latest changes, use hard refresh (Ctrl+Shift+R or Cmd+Shift+R)."
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};

export const handlePublishTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, template, filename, category = "testing" } = args;
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

  // Check GitHub config
  if (!env.GITHUB_TOKEN) throw new Error("GitHub token not configured. Run: wrangler secret put GITHUB_TOKEN");
  if (!env.GITHUB_REPO) throw new Error("GitHub repo not configured in wrangler.toml");

  // Read trip data
  const fullKey = keyPrefix + tripId;
  const tripData = await env.TRIPS.get(fullKey, "json") as any;
  if (!tripData) throw new Error(`Trip '${tripId}' not found.`);

  // Render using shared template renderer (resolves user default, checks user templates first)
  const html = await renderTripHtml(env, tripData, template, userProfile, fullKey, keyPrefix);

  // Publish to GitHub (legacy - will eventually be deprecated)
  const publicUrl = await publishToGitHub(env, outputFilename, html, {
    title: tripData.meta?.clientName || tripData.meta?.destination || tripId,
    dates: tripData.meta?.dates || tripData.dates?.start || "",
    destination: tripData.meta?.destination || "",
    category: category
  });

  // Also save to R2 for subdomain serving (new approach)
  const userId = keyPrefix.replace(/\/$/, '');
  let subdomainUrl: string | null = null;
  try {
    await savePublishedTrip(env, userId, tripId, html, {
      filename: outputFilename,
      title: tripData.meta?.clientName || tripData.meta?.destination || tripId,
      destination: tripData.meta?.destination,
      category: category
    });

    // Build subdomain URL if user has one
    if (userProfile?.subdomain) {
      subdomainUrl = `https://${userProfile.subdomain}.voygent.ai/trips/${outputFilename}`;
    }
  } catch (err) {
    console.error('Failed to save to R2:', err);
    // Don't fail the publish - GitHub is the primary for now
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
    url: publicUrl,
    subdomainUrl: subdomainUrl,
    filename: outputFilename,
    tripId,
    template,
    message: subdomainUrl
      ? `Published! View at ${subdomainUrl} (or legacy URL: ${publicUrl})`
      : `Published! View at ${publicUrl}`,
    cacheNote: "GitHub Pages may take up to 1 minute to update. If you don't see the latest changes, use hard refresh (Ctrl+Shift+R or Cmd+Shift+R).",
    ...(warningResult || {}),
    ...(Object.keys(usageInfo).length > 0 && { usage: usageInfo })
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};
