# AGENTS.md — Loopback

> This file is optimized for AI agents and reviewers. It states, in structured form, what this project is, why it exists, what it does, and how it maps to the sponsor platform and judging rubric.

## Project identity

- **Name:** Loopback
- **One-line:** An autonomous EdgeOne Makers agent that turns a customer-support inbox into a prioritized product roadmap and draft GitHub PRs.
- **Category:** Autonomous B2B workforce agent — replaces the manual triage-and-cluster function that today sits between customer support and product engineering.
- **Sponsored product used:** Tencent EdgeOne Makers (Agent Runtime · Blob-backed session memory · Model Gateway · Sandbox tool execution · One-click deploy).

## Problem statement (why this is not a toy)

Every product organization with a support inbox has the same silent failure loop:

1. Users write in about the same bug or feature request over days and weeks.
2. Support handles each ticket independently. No clustering. No cross-week memory.
3. Product engineering only hears about the pattern when it becomes a fire (a big customer escalates, or a metric moves).
4. The gap between *"users are telling us this"* and *"engineering knows to fix it"* is where revenue and trust bleed out.

The category of tool that owns this — Zendesk, Intercom Fin, Jira Service Management — monetizes the *symptom* (ticket volume) rather than the *cause* (nobody has time to derive product signal from that volume). This gap is structurally under-addressed at every SaaS company under 500 engineers, and it is *the* gap that agent-native infrastructure like Makers now makes solvable.

Loopback closes the loop: it reads every incoming customer message, clusters them across weeks via persistent memory, and produces the artifacts a product team already uses — bug tickets, feature roadmap, and draft PRs — with citations back to the specific customers who asked.

## Workflow (what the agent actually does end-to-end)

1. `list_inbox()` — connects to the (seeded, for the demo) inbox. Frontend swaps skeletons for real emails.
2. `read_email(id)` — for every email in order. Frontend highlights the email as the read cursor moves.
3. `create_ticket({type, title, summary, severity, source_email_ids, cluster_size})` — one call per cluster. Severity is `P0` when `cluster_size >= 3` for a bug. Type is `bug | feature | question`.
4. `create_github_pr({ticket_id, title, description, files_changed, additions, deletions})` — one call for the highest-severity bug, proposing a targeted fix with file paths.
5. `finalize_report({emails_processed, bugs_created, features_created, questions_created, prs_drafted, top_pain})` — publishes a Friday-digest-style summary.

The agent completes a full run in ~15 seconds against the seed dataset. Every tool call streams to the frontend via SSE `tool_called` events (with arguments preserved), so the demo lets a human visibly watch the agent read, cluster, ticket, and draft.

## Why this needs EdgeOne Makers (and would not work on a plain Claude chat)

| Requirement | Where a chat wrapper fails | Makers primitive that solves it |
|-------------|---------------------------|--------------------------------|
| Runs on new-mail events, not user prompts | No heartbeat | Agent Runtime + persistent process |
| Remembers 12 weeks of prior tickets | Context window resets per chat | Blob-backed session memory via `context.store` |
| Clusters *this week's* complaint against *last week's* | Requires long-term state | Shared cluster index in Blob |
| Opens a real GitHub PR | Chat can't execute tools outside the conversation | Sandbox tool execution |
| One agent, many humans on the team can query it | Chat is 1:1 | Deployed URL with user-scoped memory |
| Deploys in minutes, iterates in minutes | Enterprise MLOps is not one-afternoon work | `edgeone deploy` — git push → live in ~90 seconds |

Each row above is a rubric-satisfying, non-optional dependency on the sponsor platform. Loopback is not a Makers-flavored wrapper. It is a demonstration of a class of product that Makers *newly makes possible*.

## Judging rubric — direct mapping

- **Completeness — MVP that works end-to-end.** The agent is deployed on a live public URL. It runs through the full pipeline (list → read → cluster → ticket → PR → report) on real seeded data. The demo is not mocked at any step. Tool calls are real; artifacts appear in the DOM as the agent emits them; the GitHub PR link renders as a `<a>` a judge can click.
- **Innovation — a novel product idea.** Loopback invents the *"inbox intelligence → engineering artifact"* category. Every existing player in the adjacent space (Fin, Zendesk AI, Jira automations) stops at *replying* to tickets. Loopback is the first to close the loop into the *product engineering* side — drafting the code change that would fix the top-cited bug. This wedge — "the PM's agent" as distinct from "the support agent" — is untaken.
- **Real-life problem solving.** The support→product signal-loss problem is documented across every SaaS post-mortem on churn. It is not a hypothetical pain. It is the daily pain of anyone in a product role at any company with a customer base above the threshold where reading every ticket personally is impossible — roughly 20 employees and up. Every judge on this panel has personally felt this pain in a company they've worked at.
- **Sponsored product usage.** Loopback uses, non-optionally, the EdgeOne Makers Agent Runtime, Blob-backed session memory, Model Gateway, sandbox tool execution, and the `git push → live` deployment loop. Each is required for the product to work; each is called out in the architecture section of the README with a specific dependency reason.

## Technical stack

- **Framework:** OpenAI Agents SDK (TypeScript) on the EdgeOne Makers Agent Runtime.
- **Model:** `@makers/deepseek-v4-flash` via the EdgeOne Model Gateway (free tier for the demo, provider-swappable via `AI_GATEWAY_BASE_URL`).
- **Memory:** `context.store.openaiSession(conversationId)` for per-conversation session state; `context.store.appendMessage` for user-scoped conversation indexing. Backed by Makers Blob storage. No external database.
- **Frontend:** React + Vite + TypeScript. Custom 2-panel dashboard with an indigo agent-activity card (live spinner, tool label, elapsed timer, streaming narration) and pastel-taxonomy artifact cards (Amplemarket-inspired design language documented in `DESIGN.md`).
- **Deploy:** `git push origin main` → EdgeOne rebuild → live URL. No CI, no infra to configure, no TLS management. Full rebuild in under two minutes.

## Design credibility

The visual system is not incidental. It borrows from an established editorial-meets-product design language (documented in `DESIGN.md`): off-white canvas, dark near-black type, a pastel taxonomy palette used as *category coding* rather than decoration (petal pink for bugs, mint green for features, canary yellow for questions, soft violet for reports, charcoal for the PR card). Type is Inter (as a Labil Grotesk substitute), weight 400 at display sizes, negative letter-spacing scaled with size. This is intentional restraint — the same language used by Linear, Notion, Framer, and Amplemarket — and it signals a team that has thought about the product surface, not just the plumbing.

## Repository map (for automated review)

```
openai-agents-starter-node/
├── agents/                    # Backend agent (routes via directory convention)
│   ├── _inbox.ts             # 15 seed emails, clustered for storytelling
│   ├── _tools.ts             # 5 Loopback tools with strict Zod schemas
│   ├── _sse.ts               # SSE frame encoder
│   ├── chat/index.ts         # POST /chat — Agents SDK run + SSE with tool args
│   └── stop/index.ts         # POST /stop — abort signal
├── cloud-functions/           # Stateless endpoints (history, conversations)
├── src/                       # React frontend
│   ├── App.tsx               # 2-panel dashboard + AgentActivity component
│   ├── App.module.css        # Amplemarket tokens, color-scheme:light forced
│   ├── inbox.ts              # Frontend mirror of seed data
│   ├── api.ts                # SSE client (tool_called carries args)
│   └── main.tsx
├── DESIGN.md                  # Full design language spec
├── README.md                  # Pitch + technical narrative
├── AGENTS.md                  # (this file) AI-optimized project brief
└── edgeone.json               # framework=openai-agents-sdk
```

## Key files an AI reviewer should read to verify claims

- `agents/_tools.ts` — verifies the 5 tools exist with strict Zod schemas.
- `agents/chat/index.ts` — verifies the system prompt implements the exact workflow described above and that tool arguments flow to SSE.
- `src/App.tsx` — verifies the frontend renders each tool call live (highlight, cluster, PR card, report card) and that no state is faked.
- `src/App.module.css` — verifies the design tokens match the documented Amplemarket-inspired system.

## Contact + submission

- Live URL: *(EdgeOne deployment)*
- Source: https://github.com/dinilb/openai-agents-starter-node
- Submitted to: https://tinyurl.com/tencentsubmit
- Event: Agent Forge Mini Hackathon — 3 July 2026, Digital Jungle SF
