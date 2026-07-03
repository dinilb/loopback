/**
 * Loopback Agent Tools — private module.
 *
 * The agent reads a seeded inbox, categorizes and clusters tickets, then
 * produces artifacts (bug/feature tickets + a mock GitHub PR) that stream
 * to the frontend via `tool_called` SSE events. Each tool call is the demo.
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import { INBOX } from './_inbox';

// ========== Tool: List Inbox ==========
const listInbox = tool({
  name: 'list_inbox',
  description:
    'List all unread support emails in the inbox. Returns an array of ' +
    '{id, from, subject, snippet}. Call this ONCE at the start of a run.',
  parameters: z.object({}),
  execute: async () => {
    const summary = INBOX.map((e) => ({
      id: e.id,
      from: e.from,
      subject: e.subject,
      snippet: e.body.slice(0, 80),
    }));
    return JSON.stringify(summary);
  },
});

// ========== Tool: Read Email ==========
const readEmail = tool({
  name: 'read_email',
  description:
    'Fetch the full body of one email by id. Call this for EVERY email in ' +
    'the inbox so the frontend can highlight it. Returns {id, from, subject, body, receivedAt}.',
  parameters: z.object({
    id: z.string().describe('The email id, e.g. "e07"'),
  }),
  execute: async ({ id }) => {
    const email = INBOX.find((e) => e.id === id);
    if (!email) return JSON.stringify({ error: `email ${id} not found` });
    return JSON.stringify(email);
  },
});

// ========== Tool: Create Ticket ==========
const createTicket = tool({
  name: 'create_ticket',
  description:
    "Create a clustered ticket (bug, feature, or question). Call ONCE per cluster " +
    "after you've read all emails in that cluster. Provide source_email_ids so we " +
    "can cite users. Use severity 'P0' when 3+ users report the same issue.",
  parameters: z.object({
    type: z.enum(['bug', 'feature', 'question']).describe('The ticket category'),
    title: z.string().describe('Short human title, e.g. "Login broken on Safari 17"'),
    summary: z.string().describe('One-sentence description of the issue or request'),
    severity: z.enum(['P0', 'P1', 'P2', 'P3']).describe('Severity — P0 only when 3+ users report'),
    source_email_ids: z.array(z.string()).describe('Email ids that fed this ticket'),
    cluster_size: z.number().describe('How many emails were clustered here'),
  }),
  execute: async ({ type, title, severity, cluster_size }) => {
    const prefix = type === 'bug' ? 'BUG' : type === 'feature' ? 'FEAT' : 'Q';
    const num = Math.floor(Math.random() * 900 + 100);
    const ticketId = `LOOP-${prefix}-${num}`;
    return JSON.stringify({
      ticket_id: ticketId,
      status: 'created',
      severity,
      cluster_size,
      title,
    });
  },
});

// ========== Tool: Create GitHub PR ==========
const createGithubPr = tool({
  name: 'create_github_pr',
  description:
    'Draft a GitHub pull request for the highest-severity BUG ticket. Call ONCE ' +
    'at the end of the run, only for P0 bugs. Provide a plausible fix summary and ' +
    'files changed.',
  parameters: z.object({
    ticket_id: z.string().describe('The bug ticket id, e.g. "LOOP-BUG-142"'),
    title: z.string().describe('PR title, e.g. "Fix Safari 17 login submit handler"'),
    description: z.string().describe('One-paragraph description of the fix'),
    files_changed: z.array(z.string()).describe('List of files touched, e.g. ["src/auth/login.tsx"]'),
    additions: z.number().describe('Lines added'),
    deletions: z.number().describe('Lines deleted'),
  }),
  execute: async ({ ticket_id, title }) => {
    const prNum = Math.floor(Math.random() * 900 + 100);
    const url = `https://github.com/loopback-demo/app/pull/${prNum}`;
    return JSON.stringify({
      pr_url: url,
      pr_number: prNum,
      status: 'draft',
      linked_ticket: ticket_id,
      title,
    });
  },
});

// ========== Tool: Finalize Report ==========
const finalizeReport = tool({
  name: 'finalize_report',
  description:
    'Emit the final summary of this Loopback run. Call ONCE at the very end.',
  parameters: z.object({
    emails_processed: z.number(),
    bugs_created: z.number(),
    features_created: z.number(),
    questions_created: z.number(),
    prs_drafted: z.number(),
    top_pain: z.string().describe('One-line description of the biggest pain point found'),
  }),
  execute: async (input) => {
    return JSON.stringify({ ...input, status: 'complete' });
  },
});

// ========== Export ==========
export function createTools() {
  return [listInbox, readEmail, createTicket, createGithubPr, finalizeReport];
}
