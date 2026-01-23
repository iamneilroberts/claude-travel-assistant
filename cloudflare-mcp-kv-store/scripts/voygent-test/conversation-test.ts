/**
 * Conversational Test Framework for Voygent
 *
 * Simulates real Claude.ai sessions where a human user interacts with
 * a Voygent-enabled Claude assistant. The assistant makes real MCP calls
 * exactly as it would in production.
 *
 * Architecture:
 * - User Agent: Role-plays a persona, speaks ONLY natural language
 * - Assistant Agent: Has MCP tool access, responds like real Claude would
 * - Conversation flows back and forth until task is complete
 */

import type { TestScenario } from './scenarios';

// =============================================================================
// PROMPTS FOR CONVERSATIONAL TESTING
// =============================================================================

/**
 * System prompt for the USER agent (the simulated human)
 * This agent should NOT know about tools - only speak naturally
 */
export function buildUserAgentPrompt(scenario: TestScenario): string {
  return `# You are role-playing as a HUMAN USER testing Voygent

You are ${scenario.persona.name}. You are chatting with Claude (an AI assistant) that has access to a travel planning system called Voygent.

## Your Character

**Who you are:** ${scenario.persona.description}

**Your personality:** ${scenario.persona.personality}

**What you want:** ${scenario.persona.goals.join('; ')}

## Your Task

${scenario.task}

## CRITICAL RULES

1. **You are a HUMAN, not an AI** - You don't know about "tools" or "MCP" or "JSON"
2. **Speak naturally** - Use casual language, make typos occasionally, use incomplete sentences
3. **Don't be perfect** - Real users forget details, change their minds, ask "dumb" questions
4. **React authentically** - If confused, say so. If happy, express it. If frustrated, show it.
5. **Stay in character** - Michelle the busy mom gets interrupted. Jim the retiree asks his wife Barbara.

## How to Interact

When the assistant asks you questions, answer as your character would:
- If you're new to travel planning, you might not know exact dates
- If you're budget-conscious, ask about prices
- If you're tech-hesitant, ask for clarification on confusing responses

## Example Natural User Messages

Instead of: "Please create a trip with tripId 'nashville-anniversary'"
Say: "I want to plan a trip to Nashville for our anniversary"

Instead of: "Add lodging with pricePerNight 450"
Say: "We'd like a nice hotel, maybe something downtown?"

Instead of: "Call the save_trip function"
Say: "Okay that sounds good, let's go with that"

## Conversation Format

For each turn, output ONLY what you (the human user) would type in a chat box.
Do NOT include thoughts, actions, or meta-commentary.
Just write your message as if you're typing in Claude.ai.

When your task is complete or you've done what you can, say something like:
"Thanks, this looks great!" or "I think we're all set for now"

Then add on a new line: [CONVERSATION COMPLETE]

Begin the conversation now. What's the first thing you say to the travel assistant?`;
}

/**
 * System prompt for the ASSISTANT agent (Claude with Voygent MCP)
 * This agent has MCP tool access and should behave exactly like production Claude
 */
export function buildAssistantAgentPrompt(systemPrompt: string): string {
  return `${systemPrompt}

## Test Mode Instructions

You are being tested by a QA system. A simulated user will chat with you.
Respond EXACTLY as you would to a real user in Claude.ai.

Important:
1. Call get_context at the START of the conversation (as your instructions require)
2. Use tools naturally based on user requests - don't over-explain tool usage
3. Ask clarifying questions before creating trips (dates, travelers, budget, etc.)
4. Be helpful and professional, following your system prompt guidelines
5. When the user seems satisfied, ask if there's anything else

Your responses should be natural assistant messages, not test artifacts.
Do NOT mention that this is a test or that you're being evaluated.`;
}

// =============================================================================
// CONVERSATION RUNNER
// =============================================================================

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{
    tool: string;
    input: Record<string, unknown>;
    output: string;
    success: boolean;
  }>;
  timestamp: string;
}

export interface ConversationTestResult {
  scenario: TestScenario;
  conversation: ConversationTurn[];
  toolCallSummary: {
    total: number;
    successful: number;
    failed: number;
    toolsUsed: string[];
    sequence: string[];  // Order of tool calls
  };
  tripId?: string;  // If a trip was created
  previewUrl?: string;  // If trip was previewed
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'incomplete' | 'error';
  errorMessage?: string;
}

/**
 * Instructions for the orchestrating agent on how to run a conversational test
 */
export const CONVERSATION_TEST_INSTRUCTIONS = `
# How to Run a Conversational Voygent Test

This test simulates a REAL Claude.ai session with a human user.

## Setup

You will manage TWO agents in a conversation:

### 1. User Agent (simulated human)
- Role-plays the test persona
- Speaks ONLY natural language (no tool names, no JSON, no technical terms)
- Responds to assistant questions like a real person would

### 2. Assistant Agent (Voygent-enabled Claude)
- Has access to Voygent MCP tools via HTTP
- Follows the Voygent system prompt
- Makes real API calls to https://voygent.somotravel.workers.dev/mcp

## Running the Test

1. **Initialize**: Get the Voygent system prompt by calling get_context

2. **Start conversation**: Send the User Agent's first message to the Assistant Agent

3. **Loop until complete**:
   a. Assistant Agent responds (may include tool calls)
   b. Record any MCP tool calls made
   c. User Agent responds naturally to the assistant
   d. Continue until User Agent says [CONVERSATION COMPLETE]

4. **Record results**: Save the full conversation transcript with all tool calls

## Making MCP Calls

The Assistant Agent should make HTTP calls to Voygent:

\`\`\`bash
curl -X POST "https://voygent.somotravel.workers.dev/mcp?key=TestRunner.test123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "TOOL_NAME",
      "arguments": { ... }
    }
  }'
\`\`\`

## Expected Tool Call Sequence

A typical conversation should include:

1. **get_context** - Called first to load system prompt and user state
2. **save_trip** or **patch_trip** - When user provides enough info to create/update
3. **read_trip** - To verify or show trip details
4. **preview_publish** - If user wants to see the formatted proposal

## Recording the Transcript

Format each turn like this:

\`\`\`
=== TURN 1 ===
[USER]: I want to plan an anniversary trip to Nashville

[ASSISTANT]: I'd be happy to help you plan an anniversary trip to Nashville!
Before I create your trip, I have a few questions:
1. How many people will be traveling?
2. What dates are you considering?
3. Do you have a budget in mind?

[TOOL CALLS]:
- get_context() → Success (loaded 14 trips, system prompt)

=== TURN 2 ===
[USER]: Just me and my wife Sarah, March 20-22, around $2500

[ASSISTANT]: Perfect! A romantic 3-day Nashville getaway for you and Sarah.
I've created your trip with the details...

[TOOL CALLS]:
- save_trip(tripId: "nashville-anniversary-2026", data: {...}) → Success
\`\`\`

## Success Criteria

The test passes if:
1. get_context was called first
2. A trip was created (save_trip called successfully)
3. The conversation felt natural (no tool names leaked to user)
4. User's goals were addressed
`;

// =============================================================================
// HELPER TYPES
// =============================================================================

export interface TestSessionForAdmin {
  id: string;
  scenarioId: string;
  scenarioName: string;
  tier: 1 | 2 | 3 | 4;
  startedAt: string;
  completedAt: string;
  persona: {
    name: string;
    experience: string;
    description?: string;
  };
  tripId?: string;
  previewUrl?: string;
  mcpCallCount: number;
  mcpSuccessCount: number;
  toolsUsed: string[];
  transcript: string;  // The full conversation
  agentNotes?: string;
  judgeResult?: {
    scenarioId: string;
    passed: boolean;
    scores: {
      taskCompletion: number;
      uxQuality: number;
      dataQuality: number;
      errorHandling: number;
      overall: number;
    };
    successCriteria: Record<string, Record<string, string>>;
    findings: Array<{
      type: string;
      area: string;
      description: string;
      evidence: string;
    }>;
    proposedFAQs: Array<{
      question: string;
      suggestedAnswer: string;
      evidence: string;
    }>;
    summary: string;
  };
}

/**
 * Convert a ConversationTestResult to the admin dashboard format
 */
export function toAdminSession(result: ConversationTestResult): TestSessionForAdmin {
  const transcript = result.conversation.map((turn, i) => {
    let text = `=== TURN ${Math.floor(i/2) + 1} ===\n`;
    text += `[${turn.role.toUpperCase()}]: ${turn.content}\n`;
    if (turn.toolCalls && turn.toolCalls.length > 0) {
      text += `\n[TOOL CALLS]:\n`;
      for (const call of turn.toolCalls) {
        text += `- ${call.tool}(${JSON.stringify(call.input).substring(0, 100)}...) → ${call.success ? 'Success' : 'Failed'}\n`;
      }
    }
    return text;
  }).join('\n');

  return {
    id: `session-${result.scenario.id}-${Date.now().toString(36)}`,
    scenarioId: result.scenario.id,
    scenarioName: result.scenario.name,
    tier: result.scenario.tier,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    persona: {
      name: result.scenario.persona.name,
      experience: result.scenario.persona.experience,
      description: result.scenario.persona.description
    },
    tripId: result.tripId,
    previewUrl: result.previewUrl,
    mcpCallCount: result.toolCallSummary.total,
    mcpSuccessCount: result.toolCallSummary.successful,
    toolsUsed: result.toolCallSummary.toolsUsed,
    transcript
  };
}
