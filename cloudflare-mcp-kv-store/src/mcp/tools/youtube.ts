/**
 * MCP Tool Handlers: YouTube operations
 * Handles: youtube_search
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';

export const handleYoutubeSearch: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
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
    return {
      content: [{ type: "text", text: JSON.stringify({
        videos: [],
        message: "No videos found for this query. Try different search terms."
      }, null, 2) }]
    };
  }

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

  const result = {
    videos,
    query,
    _usage: "Add videos to trips using the 'media' array (general) or 'itinerary[].videos' (day-specific). Format: { id: 'VIDEO_ID', caption: 'Description' }"
  };

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
};
