/**
 * MCP Tool Handlers: Comment operations
 * Handles: get_comments, get_all_comments, dismiss_comments
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';
import { getCommentIndex, removeFromCommentIndex, listAllKeys } from '../../lib/kv';

export const handleGetComments: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, markAsRead = true } = args;

  // Read comments
  const commentsKey = `${keyPrefix}${tripId}/_comments`;
  const data = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;
  const comments = data?.comments || [];

  if (comments.length === 0) {
    return {
      content: [{ type: "text", text: `No comments for trip '${tripId}'.` }]
    };
  }

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

  comments.forEach((c) => {
    const isNew = !c.read ? '🆕 ' : '';
    const time = new Date(c.timestamp).toLocaleString();
    const section = c.item ? `${c.section} - ${c.item}` : c.section;
    output += `${isNew}[${section}] ${c.name} - ${time}\n`;
    output += `"${c.message}"\n`;
    if (c.email) output += `Reply to: ${c.email}\n`;
    output += '\n';
  });

  return {
    content: [{ type: "text", text: output }]
  };
};

export const handleGetAllComments: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const allComments: { tripId: string; comments: any[] }[] = [];
  let commentIndex = await getCommentIndex(env, keyPrefix);
  let rebuiltIndex = false;

  if (commentIndex.length === 0) {
    const keys = await listAllKeys(env, { prefix: keyPrefix });
    const rebuilt: string[] = [];

    for (const key of keys) {
      if (!key.name.endsWith('/_comments')) continue;
      const data = await env.TRIPS.get(key.name, "json") as { comments: any[] } | null;
      if (!data?.comments?.length) continue;

      const tripId = key.name.replace(keyPrefix, '').replace('/_comments', '');
      const activeComments = data.comments.filter(c => !c.dismissed);
      if (activeComments.length > 0) {
        rebuilt.push(tripId);
      }

      const unreadComments = activeComments.filter(c => !c.read);
      if (unreadComments.length > 0) {
        allComments.push({ tripId, comments: unreadComments });
      }
    }

    commentIndex = rebuilt;
    await env.TRIPS.put(`${keyPrefix}_comment-index`, JSON.stringify(rebuilt));
    rebuiltIndex = true;
  }

  if (!rebuiltIndex) {
    for (const tripId of commentIndex) {
      const commentsKey = `${keyPrefix}${tripId}/_comments`;
      const data = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;
      if (!data?.comments?.length) {
        await removeFromCommentIndex(env, keyPrefix, tripId);
        continue;
      }

      const activeComments = data.comments.filter(c => !c.dismissed);
      if (activeComments.length === 0) {
        await removeFromCommentIndex(env, keyPrefix, tripId);
        continue;
      }

      const unreadComments = activeComments.filter(c => !c.read);
      if (unreadComments.length > 0) {
        allComments.push({ tripId, comments: unreadComments });
      }
    }
  }

  if (allComments.length === 0) {
    return {
      content: [{ type: "text", text: "No new comments across any trips." }]
    };
  }

  let output = `📬 New Comments Across All Trips\n\n`;
  let totalNew = 0;

  allComments.forEach(({ tripId, comments }) => {
    totalNew += comments.length;
    output += `**${tripId}** (${comments.length} new)\n`;
    comments.slice(0, 3).forEach(c => {
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

  return {
    content: [{ type: "text", text: output }]
  };
};

export const handleDismissComments: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { tripId, commentIds } = args;
  const commentsKey = `${keyPrefix}${tripId}/_comments`;
  const data = await env.TRIPS.get(commentsKey, "json") as { comments: any[] } | null;

  if (!data?.comments?.length) {
    return {
      content: [{ type: "text", text: `No comments found for trip '${tripId}'.` }]
    };
  }

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

  return {
    content: [{ type: "text", text: `✓ Dismissed ${dismissedCount} comment(s) for trip '${tripId}'. They will no longer appear in session start.` }]
  };
};
