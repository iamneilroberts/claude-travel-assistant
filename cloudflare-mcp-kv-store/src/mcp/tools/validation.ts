/**
 * MCP Tool Handlers: Validation and analysis operations
 * Handles: validate_trip, import_quote, analyze_profitability, get_prompt
 */

import type { Env, UserProfile, McpToolHandler } from '../../types';
import { stripEmpty } from '../../lib/utils';

export const handleValidateTrip: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
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

  const result = {
    tripId,
    tripData,
    _instruction: instruction
  };

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

export const handleImportQuote: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
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

  const result = {
    tripId,
    tripData,
    quoteText,
    quoteType,
    _instruction: instruction
  };

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

export const handleAnalyzeProfitability: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
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

  const result = {
    tripId,
    tripData,
    targetCommission: targetCommission || null,
    _instruction: instruction
  };

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};

export const handleGetPrompt: McpToolHandler = async (args, env, keyPrefix, userProfile, authKey, ctx) => {
  const { name: promptName } = args;

  // Load the requested prompt from KV
  const promptKey = `_prompts/${promptName}`;
  const promptContent = await env.TRIPS.get(promptKey, "text");

  if (!promptContent) {
    throw new Error(`Prompt '${promptName}' not found. Available prompts: cruise-instructions, handle-changes, research-destination, validate-trip, import-quote, analyze-profitability`);
  }

  const result = {
    promptName,
    content: promptContent,
    _note: "Use this guidance for the current task. The instructions above are specialized for this scenario."
  };

  return {
    content: [{ type: "text", text: JSON.stringify(stripEmpty(result), null, 2) }]
  };
};
