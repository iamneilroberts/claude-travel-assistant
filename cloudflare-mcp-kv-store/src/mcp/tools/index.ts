/**
 * MCP Tool Handlers - Barrel export
 * Maps tool names to their handler implementations
 * Wraps all handlers with metrics tracking
 */

import type { McpToolHandler } from '../../types';
import { withMetrics } from '../metrics-wrapper';

// Import all tool handlers
import { handleGetContext } from './get-context';
import {
  handleListTrips,
  handleReadTrip,
  handleReadTripSection,
  handleSaveTrip,
  handlePatchTrip,
  handleDeleteTrip,
  handleSummarizeGroup
} from './trips';
import {
  handleGetComments,
  handleGetAllComments,
  handleDismissComments,
  handleReplyToComment
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
  handleGetPrompt,
  handleTripChecklist
} from './validation';
import {
  handleLogSupportIntent,
  handleSubmitSupport,
  handleReplyToAdmin,
  handleDismissAdminMessage
} from './support';
import {
  handleAddTripImage,
  handlePrepareImageUpload
} from './images';
import { handleYoutubeSearch } from './youtube';
import {
  setReference,
  getReference,
  validateTrip as validateReference
} from './reference';
import {
  handleListSampleTrips,
  handleAcceptSampleTrips,
  handleDeclineSampleTrips,
  handleClearSampleTrips
} from './sample-trips';
import { handleProposeSolution } from './knowledge';

// Tool name to handler mapping - all wrapped with metrics
export const toolHandlers: Record<string, McpToolHandler> = {
  get_context: withMetrics('get_context', handleGetContext),
  list_trips: withMetrics('list_trips', handleListTrips),
  read_trip: withMetrics('read_trip', handleReadTrip),
  read_trip_section: withMetrics('read_trip_section', handleReadTripSection),
  save_trip: withMetrics('save_trip', handleSaveTrip),
  patch_trip: withMetrics('patch_trip', handlePatchTrip),
  delete_trip: withMetrics('delete_trip', handleDeleteTrip),
  summarize_group: withMetrics('summarize_group', handleSummarizeGroup),
  list_templates: withMetrics('list_templates', handleListTemplates),
  preview_publish: withMetrics('preview_publish', handlePreviewPublish),
  publish_trip: withMetrics('publish_trip', handlePublishTrip),
  validate_trip: withMetrics('validate_trip', handleValidateTrip),
  trip_checklist: withMetrics('trip_checklist', handleTripChecklist),
  import_quote: withMetrics('import_quote', handleImportQuote),
  analyze_profitability: withMetrics('analyze_profitability', handleAnalyzeProfitability),
  get_prompt: withMetrics('get_prompt', handleGetPrompt),
  get_comments: withMetrics('get_comments', handleGetComments),
  get_all_comments: withMetrics('get_all_comments', handleGetAllComments),
  dismiss_comments: withMetrics('dismiss_comments', handleDismissComments),
  reply_to_comment: withMetrics('reply_to_comment', handleReplyToComment),
  log_support_intent: withMetrics('log_support_intent', handleLogSupportIntent),
  submit_support: withMetrics('submit_support', handleSubmitSupport),
  reply_to_admin: withMetrics('reply_to_admin', handleReplyToAdmin),
  dismiss_admin_message: withMetrics('dismiss_admin_message', handleDismissAdminMessage),
  add_trip_image: withMetrics('add_trip_image', handleAddTripImage),
  prepare_image_upload: withMetrics('prepare_image_upload', handlePrepareImageUpload),
  youtube_search: withMetrics('youtube_search', handleYoutubeSearch),
  set_reference: withMetrics('set_reference', setReference),
  get_reference: withMetrics('get_reference', getReference),
  validate_reference: withMetrics('validate_reference', validateReference),
  list_sample_trips: withMetrics('list_sample_trips', handleListSampleTrips),
  accept_sample_trips: withMetrics('accept_sample_trips', handleAcceptSampleTrips),
  decline_sample_trips: withMetrics('decline_sample_trips', handleDeclineSampleTrips),
  clear_sample_trips: withMetrics('clear_sample_trips', handleClearSampleTrips),
  propose_solution: withMetrics('propose_solution', handleProposeSolution)
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
  handleSummarizeGroup,
  handleListTemplates,
  handlePreviewPublish,
  handlePublishTrip,
  handleValidateTrip,
  handleTripChecklist,
  handleImportQuote,
  handleAnalyzeProfitability,
  handleGetPrompt,
  handleGetComments,
  handleGetAllComments,
  handleDismissComments,
  handleReplyToComment,
  handleLogSupportIntent,
  handleSubmitSupport,
  handleReplyToAdmin,
  handleDismissAdminMessage,
  handleAddTripImage,
  handlePrepareImageUpload,
  handleYoutubeSearch,
  handleListSampleTrips,
  handleAcceptSampleTrips,
  handleDeclineSampleTrips,
  handleClearSampleTrips,
  handleProposeSolution
};
