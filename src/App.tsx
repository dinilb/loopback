import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessageStream } from './api';
import { INBOX, type Email } from './inbox';
import styles from './App.module.css';

type EmailStatus = 'unread' | 'reading' | 'read';

interface Ticket {
  id: string;
  type: 'bug' | 'feature' | 'question';
  title: string;
  summary: string;
  severity: string;
  sourceIds: string[];
  clusterSize: number;
}

interface PR {
  url: string;
  number: number;
  title: string;
  ticketId: string;
  files: string[];
  additions: number;
  deletions: number;
}

interface Report {
  emails: number;
  bugs: number;
  features: number;
  questions: number;
  prs: number;
  topPain: string;
}

interface Thought {
  id: number;
  icon: string;
  text: string;
  timestamp: number;
}

const TOOL_META: Record<string, { icon: string; label: string }> = {
  booting: { icon: '⚡', label: 'Waking up' },
  list_inbox: { icon: '📬', label: 'Connecting to inbox' },
  read_email: { icon: '📖', label: 'Reading email' },
  create_ticket: { icon: '🎫', label: 'Creating ticket' },
  create_github_pr: { icon: '🔗', label: 'Drafting PR' },
  finalize_report: { icon: '📊', label: 'Writing report' },
  done: { icon: '✅', label: 'Done' },
};

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function App() {
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, EmailStatus>>({});
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pr, setPr] = useState<PR | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [currentTool, setCurrentTool] = useState<string>('idle');
  const [toolCallCount, setToolCallCount] = useState<number>(0);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const thoughtIdRef = useRef<number>(0);
  const conversationIdRef = useRef<string>(crypto.randomUUID());

  // Elapsed timer
  useEffect(() => {
    if (!running || startedAt == null) return;
    const iv = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(iv);
  }, [running, startedAt]);

  const addThought = useCallback((icon: string, text: string) => {
    thoughtIdRef.current += 1;
    const t: Thought = { id: thoughtIdRef.current, icon, text, timestamp: Date.now() };
    setThoughts((prev) => [...prev, t].slice(-8));
  }, []);

  const reset = useCallback(() => {
    setInboxLoaded(false);
    setStatuses({});
    setTickets([]);
    setPr(null);
    setReport(null);
    setThoughts([]);
    setCurrentTool('idle');
    setToolCallCount(0);
    setStartedAt(null);
    setElapsed(0);
    conversationIdRef.current = crypto.randomUUID();
  }, []);

  const handleRun = useCallback(() => {
    if (running) return;
    reset();
    setRunning(true);
    setCurrentTool('booting');
    setStartedAt(Date.now());
    addThought('⚡', 'Booting Loopback agent on EdgeOne runtime…');

    sendMessageStream(
      'run',
      {
        onTextDelta: () => {},
        onToolCalled: (tool, args) => {
          setCurrentTool(tool);
          setToolCallCount((n) => n + 1);

          if (tool === 'list_inbox') {
            setInboxLoaded(true);
            addThought('📬', `Connected to inbox. Found ${INBOX.length} unread emails.`);
            return;
          }

          if (tool === 'read_email' && args?.id) {
            const emailId = args.id as string;
            const email = INBOX.find((e) => e.id === emailId);
            setStatuses((prev) => {
              const next: Record<string, EmailStatus> = {};
              for (const [k, v] of Object.entries(prev)) {
                next[k] = v === 'reading' ? 'read' : v;
              }
              next[emailId] = 'reading';
              return next;
            });
            addThought('📖', `Reading email from ${email?.from ?? '?'} — "${email?.subject ?? emailId}"`);
            return;
          }

          if (tool === 'create_ticket') {
            const t: Ticket = {
              id: `LOOP-${(args?.type ?? 'X').toString().toUpperCase().slice(0, 4)}-${Math.floor(Math.random() * 900 + 100)}`,
              type: (args?.type as Ticket['type']) ?? 'bug',
              title: args?.title ?? 'Untitled',
              summary: args?.summary ?? '',
              severity: args?.severity ?? 'P2',
              sourceIds: (args?.source_email_ids as string[]) ?? [],
              clusterSize: (args?.cluster_size as number) ?? 1,
            };
            setTickets((prev) => [...prev, t]);
            const emoji = t.type === 'bug' ? '🐛' : t.type === 'feature' ? '✨' : '❓';
            addThought(emoji, `Clustered ${t.clusterSize} email${t.clusterSize !== 1 ? 's' : ''} → ${t.type} ticket "${t.title}" (${t.severity})`);
            setStatuses((prev) => {
              const next = { ...prev };
              for (const id of t.sourceIds) {
                next[id] = 'read';
              }
              return next;
            });
            return;
          }

          if (tool === 'create_github_pr') {
            const p: PR = {
              url: (args?.pr_url as string) ?? `https://github.com/loopback-demo/app/pull/${Math.floor(Math.random() * 900 + 100)}`,
              number: (args?.pr_number as number) ?? Math.floor(Math.random() * 900 + 100),
              title: args?.title ?? 'Fix',
              ticketId: args?.ticket_id ?? '',
              files: (args?.files_changed as string[]) ?? [],
              additions: (args?.additions as number) ?? 0,
              deletions: (args?.deletions as number) ?? 0,
            };
            setPr(p);
            addThought('🔗', `Drafted GitHub PR: "${p.title}" — +${p.additions} −${p.deletions}`);
            return;
          }

          if (tool === 'finalize_report') {
            const r: Report = {
              emails: (args?.emails_processed as number) ?? 0,
              bugs: (args?.bugs_created as number) ?? 0,
              features: (args?.features_created as number) ?? 0,
              questions: (args?.questions_created as number) ?? 0,
              prs: (args?.prs_drafted as number) ?? 0,
              topPain: (args?.top_pain as string) ?? '',
            };
            setReport(r);
            addThought('📊', `Summary written. Top pain: ${r.topPain}`);
          }
        },
        onDone: () => {
          setRunning(false);
          setCurrentTool('done');
          setStatuses((prev) => {
            const next: Record<string, EmailStatus> = {};
            for (const [k, v] of Object.entries(prev)) {
              next[k] = v === 'reading' ? 'read' : v;
            }
            return next;
          });
          addThought('✅', 'Run complete.');
        },
        onError: (err) => {
          setRunning(false);
          addThought('⚠️', `Error: ${err.message}`);
        },
      },
      conversationIdRef.current,
    );
  }, [running, reset, addThought]);

  const bugCount = tickets.filter((t) => t.type === 'bug').length;
  const featCount = tickets.filter((t) => t.type === 'feature').length;
  const qCount = tickets.filter((t) => t.type === 'question').length;

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.mark}>◐</div>
          <div>
            <div className={styles.brandName}>Loopback</div>
            <div className={styles.brandTag}>Your inbox is your roadmap.</div>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.secondary} onClick={reset} disabled={running}>Reset</button>
          <button className={styles.primary} onClick={handleRun} disabled={running}>
            {running ? 'Running…' : '▶  Run Loopback'}
          </button>
        </div>
      </header>

      <main className={styles.grid}>
        <section className={styles.inbox}>
          <div className={styles.panelHeader}>
            <span className={styles.eyebrow}>Inbox</span>
            <span className={styles.count}>
              {inboxLoaded ? `${INBOX.length} unread` : running ? 'connecting…' : '—'}
            </span>
          </div>
          <div className={styles.emailList}>
            {!inboxLoaded && !running && (
              <div className={styles.empty}>Click "Run Loopback" to start.</div>
            )}
            {!inboxLoaded && running && (
              <>
                <SkeletonEmail />
                <SkeletonEmail />
                <SkeletonEmail />
                <SkeletonEmail />
              </>
            )}
            {inboxLoaded && INBOX.map((e) => (
              <EmailRow key={e.id} email={e} status={statuses[e.id] ?? 'unread'} />
            ))}
          </div>
        </section>

        <section className={styles.artifacts}>
          <AgentActivity
            tool={currentTool}
            running={running}
            elapsed={elapsed}
            toolCallCount={toolCallCount}
            thoughts={thoughts}
          />

          <div className={styles.panelHeader}>
            <span className={styles.eyebrow}>Artifacts</span>
            <span className={styles.count}>
              {bugCount} bugs · {featCount} features · {qCount} questions
            </span>
          </div>

          <div className={styles.artifactList}>
            {tickets.length === 0 && !pr && !running && (
              <div className={styles.empty}>
                Tickets appear here as Loopback clusters your inbox.
              </div>
            )}
            {tickets.map((t) => (
              <TicketCard key={t.id} ticket={t} />
            ))}
            {pr && <PRCard pr={pr} />}
            {report && <ReportCard report={report} />}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        Built on <strong>EdgeOne Makers</strong> — Agent Runtime · Memory · Model Gateway
      </footer>
    </div>
  );
}

function AgentActivity({
  tool,
  running,
  elapsed,
  toolCallCount,
  thoughts,
}: {
  tool: string;
  running: boolean;
  elapsed: number;
  toolCallCount: number;
  thoughts: Thought[];
}) {
  const meta = TOOL_META[tool] ?? { icon: '💭', label: tool };
  const active = running && tool !== 'done';
  return (
    <div className={styles.agentCard}>
      <div className={styles.agentTop}>
        <div className={styles.agentHead}>
          <div className={active ? styles.spinnerActive : styles.spinner}>
            <div className={styles.spinnerIcon}>{meta.icon}</div>
          </div>
          <div>
            <div className={styles.agentEyebrow}>Loopback Agent</div>
            <div className={styles.agentAction}>{meta.label}{active ? '…' : ''}</div>
          </div>
        </div>
        <div className={styles.agentStats}>
          <div className={styles.agentStat}>
            <span>{fmtElapsed(elapsed)}</span>
            <label>elapsed</label>
          </div>
          <div className={styles.agentStat}>
            <span>{toolCallCount}</span>
            <label>steps</label>
          </div>
        </div>
      </div>
      <div className={styles.thoughts}>
        {thoughts.length === 0 && (
          <div className={styles.thoughtPlaceholder}>
            {running ? 'Warming up…' : 'Idle. Click Run Loopback to start.'}
          </div>
        )}
        {thoughts.map((t) => (
          <div key={t.id} className={styles.thought}>
            <span className={styles.thoughtIcon}>{t.icon}</span>
            <span className={styles.thoughtText}>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonEmail() {
  return (
    <div className={styles.skeleton}>
      <div className={`${styles.skelLine} ${styles.skelShort}`} />
      <div className={`${styles.skelLine} ${styles.skelMed}`} />
      <div className={`${styles.skelLine} ${styles.skelLong}`} />
    </div>
  );
}

function EmailRow({ email, status }: { email: Email; status: EmailStatus }) {
  const cls = [
    styles.email,
    status === 'reading' && styles.emailReading,
    status === 'read' && styles.emailRead,
  ].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className={styles.emailMeta}>
        <span className={styles.emailFrom}>{email.from}</span>
        <span className={styles.emailStatus}>
          {status === 'reading' ? '● reading' : status === 'read' ? '✓ read' : ''}
        </span>
      </div>
      <div className={styles.emailSubject}>{email.subject}</div>
      <div className={styles.emailBody}>{email.body}</div>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const tone =
    ticket.type === 'bug' ? styles.bugCard :
    ticket.type === 'feature' ? styles.featureCard :
    styles.questionCard;
  const emoji = ticket.type === 'bug' ? '🐛' : ticket.type === 'feature' ? '✨' : '❓';
  return (
    <div className={`${styles.card} ${tone}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardType}>{emoji} {ticket.type.toUpperCase()}</span>
        <span className={styles.cardSev}>{ticket.severity}</span>
      </div>
      <div className={styles.cardTitle}>{ticket.title}</div>
      <div className={styles.cardSummary}>{ticket.summary}</div>
      <div className={styles.cardMeta}>
        {ticket.clusterSize} user{ticket.clusterSize !== 1 ? 's' : ''}
        {ticket.sourceIds.length > 0 && (
          <> · sources: {ticket.sourceIds.join(', ')}</>
        )}
      </div>
    </div>
  );
}

function PRCard({ pr }: { pr: PR }) {
  return (
    <div className={`${styles.card} ${styles.prCard}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardType}>🔗 GITHUB PR</span>
        <span className={styles.cardSev}>#{pr.number} · draft</span>
      </div>
      <div className={styles.cardTitle}>{pr.title}</div>
      <div className={styles.cardMeta}>
        linked: {pr.ticketId} · +{pr.additions} −{pr.deletions}
        {pr.files.length > 0 && (
          <div className={styles.prFiles}>{pr.files.join(' · ')}</div>
        )}
      </div>
      <a className={styles.prLink} href={pr.url} target="_blank" rel="noreferrer">{pr.url}</a>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  return (
    <div className={`${styles.card} ${styles.reportCard}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardType}>📊 WEEKLY REPORT</span>
      </div>
      <div className={styles.cardTitle}>Top pain: {report.topPain}</div>
      <div className={styles.reportStats}>
        <div><strong>{report.emails}</strong><span>emails</span></div>
        <div><strong>{report.bugs}</strong><span>bugs</span></div>
        <div><strong>{report.features}</strong><span>features</span></div>
        <div><strong>{report.questions}</strong><span>questions</span></div>
        <div><strong>{report.prs}</strong><span>PRs</span></div>
      </div>
    </div>
  );
}
