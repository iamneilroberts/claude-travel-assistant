/**
 * MCP Tool Handlers - Barrel export
 * Maps tool names to their handler implementations
 */

import type { McpToolHandler } from '../../types';

// Import all tool handlers
import { handleGetContext } from './get-context';
import {
  handleListTrips,
  handleReadTrip,
  handleReadTripSection,
  handleSaveTrip,
  handlePatchTrip,
  handleDeleteTrip
} from './trips';
import {
  handleGetComments,
  handleGetAllComments,
  handleDismissComments
} from './comments';
import {
  handleListTemplates,
  handlePreviewPublish,
  handlePublishTrip
} from './publishing';
import {
  handleValidateTrip,
  handleImportQuote,
  handleAnalyzeProfitability,
  handleGetPrompt
} from './validation';
import {
  handleSubmitSupport,
  handleReplyToAdmin,
  handleDismissAdminMessage
} from './support';
import {
  handleAddTripImage,
  handlePrepareImageUpload
} from './images';
import { handleYoutubeSearch } from './youtube';

// Tool name to handler mapping
export const toolHandlers: Record<string, McpToolHandler> = {
  get_context: handleGetContext,
  list_trips: handleListTrips,
  read_trip: handleReadTrip,
  read_trip_section: handleReadTripSection,
  save_trip: handleSaveTrip,
  patch_trip: handlePatchTrip,
  delete_trip: handleDeleteTrip,
  list_templates: handleListTemplates,
  preview_publish: handlePreviewPublish,
  publish_trip: handlePublishTrip,
  validate_trip: handleValidateTrip,
  import_quote: handleImportQuote,
  analyze_profitability: handleAnalyzeProfitability,
  get_prompt: handleGetPrompt,
  get_comments: handleGetComments,
  get_all_comments: handleGetAllComments,
  dismiss_comments: handleDismissComments,
  submit_support: handleSubmitSupport,
  reply_to_admin: handleReplyToAdmin,
  dismiss_admin_message: handleDismissAdminMessage,
  add_trip_image: handleAddTripImage,
  prepare_image_upload: handlePrepareImageUpload,
  youtube_search: handleYoutubeSearch
};

// Re-export all handlers for direct imports if needed
export {
  handleGetContext,
  handleListTrips,
  handleReadTrip,
  handleReadTripSection,
  handleSaveTrip,
  handlePatchTrip,
  handleDeleteTrip,
  handleListTemplates,
  handlePreviewPublish,
  handlePublishTrip,
  handleValidateTrip,
  handleImportQuote,
  handleAnalyzeProfitability,
  handleGetPrompt,
  handleGetComments,
  handleGetAllComments,
  handleDismissComments,
  handleSubmitSupport,
  handleReplyToAdmin,
  handleDismissAdminMessage,
  handleAddTripImage,
  handlePrepareImageUpload,
  handleYoutubeSearch
};
