/**
 * Agent handler — EdgeOne Makers
 * ========================================
 *
 * File path agents/chat/index.ts maps to **POST /chat**
 * (EdgeOne Makers routing convention: directory name = route, index = default entry)
 *
 * Files starting with _ (e.g. _tools.ts, _sse.ts) are private modules,
 * not mapped as public routes.
 *
 * context convention:
 *   context.request.body    — object, request body
 *   context.request.signal  — AbortSignal, set when /chat/stop is called
 *   conversation_id — conversation ID
 *   context.runId           — current run ID
 */

import OpenAI from 'openai';
import { run, Agent, OpenAIChatCompletionsModel, type Session } from '@openai/agents';
import { createLogger } from '../_logger';
import { createTools } from '../_tools';
import { sseResponse } from '../_sse';

const logger = createLogger('chat');
const DEFAULT_MODEL = '@makers/deepseek-v4-flash';

export async function onRequest(context: any) {
  const body = context.request.body ?? {};
  const message = body.message as string | undefined;
  if (!message) {
    return new Response(
      JSON.stringify({ error: "'message' is required" }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Accept both camelCase (chat handler historical convention) and snake_case
  // (cloud-functions convention) as a body field name for the user id.
  const rawUserId = typeof body.userId === 'string'
    ? body.userId
    : (typeof body.user_id === 'string' ? body.user_id : '');
  const userId = rawUserId.trim() || undefined;
  const userMsgId = typeof body.userMsgId === 'string' ? body.userMsgId : undefined;

  const conversationId: string = context.conversation_id ?? '';
  const signal: AbortSignal | undefined = context.request.signal;

  logger.log(`[request] cid=${conversationId}, uid=${userId ?? '-'}, message="${message.slice(0, 50)}..."`);

  // Write a user-indexed copy of the user message so /conversations
  // (which scans the user_conversation_index prefix) can list this thread.
  // The OpenAI Agents SDK Session adapter does NOT pass user_id when it
  // persists turns, so without this manual write the user index stays
  // empty and listConversations({userId}) returns []. The duplicate is
  // filtered out of /history because that route already drops items
  // marked with metadata.agent_sdk_session.
  if (userId && conversationId) {
    try {
      const appendArgs: Record<string, unknown> = {
        conversationId,
        role: 'user',
        content: message,
        userId,
      };
      if (userMsgId) appendArgs.messageId = userMsgId;
      await context.store.appendMessage(appendArgs);
    } catch (e) {
      // Non-fatal — chat itself should keep working even if the
      // user-index write fails.
      logger.error('[chat] failed to write user index:', e);
    }
  }

  // Use built-in store session adapter for persistence
  const session: Session | undefined = conversationId
    ? context.store.openaiSession(conversationId)
    : undefined;

  // Configure the OpenAI-compatible LLM model directly from runtime env.
  const env = context.env as Record<string, string | undefined>;
  const llmClient = new OpenAI({
    apiKey: env.AI_GATEWAY_API_KEY,
    baseURL: env.AI_GATEWAY_BASE_URL,
  });
  const model = new OpenAIChatCompletionsModel(
    llmClient,
    env.AI_GATEWAY_MODEL ?? DEFAULT_MODEL,
  );

  // Create OpenAI Agent — Loopback
  const agent = new Agent({
    name: 'Loopback',
    instructions:
      "You are Loopback — an autonomous agent that turns a support inbox into a product roadmap.\n" +
      "\n" +
      "When the user sends any message (typically just 'run'), execute this exact workflow:\n" +
      "  1. Call `list_inbox` ONCE to see all emails.\n" +
      "  2. For EVERY email, call `read_email(id)`. Read them in order. This is the visible processing step.\n" +
      "  3. Group similar emails into clusters (same bug, same feature request, same question).\n" +
      "     - Login/Safari/sign-in complaints → one cluster.\n" +
      "     - Dark mode / night mode / dark theme requests → one cluster.\n" +
      "     - CSV export slowness → one cluster.\n" +
      "     - Pricing questions → one cluster.\n" +
      "     - Praise and rants without a specific issue → do NOT ticket.\n" +
      "  4. For each cluster call `create_ticket` ONCE with type (bug|feature|question), title, summary, severity, source_email_ids, and cluster_size.\n" +
      "     - severity='P0' when cluster_size >= 3 for a bug.\n" +
      "  5. For the highest-severity BUG (P0), call `create_github_pr` ONCE with a plausible fix.\n" +
      "  6. Call `finalize_report` ONCE with counts and a one-line 'top_pain' summary.\n" +
      "\n" +
      "RULES:\n" +
      "- Use EXACT tool names: list_inbox, read_email, create_ticket, create_github_pr, finalize_report.\n" +
      "- Do NOT narrate before, between, or after tool calls. No 'I'll start by...', 'Now I will...', etc.\n" +
      "- Keep any final text reply under 30 words — the tool calls are the show.\n" +
      "- Read every email even if you can guess the cluster from the subject.",
    tools: createTools(),
    model: model,
  });

  // Map an SDK stream event to a business SSE event, or null to skip.
  const toSseEvent = (e: any) => {
    if (e.type === 'raw_model_stream_event' && e.data?.type === 'output_text_delta') {
      const delta = e.data.delta as string;
      logger.log(`[stream] text_delta: ${JSON.stringify(delta)}`);
      return { event: 'text_delta', data: { delta } };
    }
    if (e.type === 'run_item_stream_event' && e.name === 'tool_called') {
      const tool = e.item?.name ?? e.item?.rawItem?.name;
      if (tool) {
        // Extract tool arguments so the frontend can render specifically
        // (e.g. highlight email id, render ticket card).
        const rawArgs = e.item?.rawItem?.arguments ?? e.item?.arguments;
        let args: any = null;
        if (typeof rawArgs === 'string') {
          try { args = JSON.parse(rawArgs); } catch { args = { _raw: rawArgs }; }
        } else if (rawArgs && typeof rawArgs === 'object') {
          args = rawArgs;
        }
        logger.log(`[stream] tool_called: ${tool} args=${JSON.stringify(args)}`);
        return { event: 'tool_called', data: { tool, args } };
      }
    }
    return null;
  };

  // Convert SDK stream events into business SSE events.
  return sseResponse(
    async function* () {
      const result = await run(agent, message, { stream: true, signal, session });
      for await (const event of result.toStream()) {
        if (signal?.aborted) break;
        const sse = toSseEvent(event);
        if (sse) yield sse;
      }
    },
    { signal, logger },
  );
}
