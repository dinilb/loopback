import { useState, useCallback, useRef } from 'react';
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

export default function App() {
  const [statuses, setStatuses] = useState<Record<string, EmailStatus>>({});
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [pr, setPr] = useState<PR | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('Ready. Click "Run Loopback" to process the inbox.');
  const [running, setRunning] = useState(false);
  const conversationIdRef = useRef<string>(crypto.randomUUID());

  const reset = useCallback(() => {
    setStatuses({});
    setTickets([]);
    setPr(null);
    setReport(null);
    setCurrentStatus('Ready. Click "Run Loopback" to process the inbox.');
    conversationIdRef.current = crypto.randomUUID();
  }, []);

  const handleRun = useCallback(() => {
    if (running) return;
    reset();
    setRunning(true);
    setCurrentStatus('Loopback is reading your inbox…');

    sendMessageStream(
      'run',
      {
        onTextDelta: () => {},
        onToolCalled: (tool, args) => {
          if (tool === 'list_inbox') {
            setCurrentStatus(`📬 Loaded ${INBOX.length} unread emails. Reading them one by one…`);
            return;
          }
          if (tool === 'read_email' && args?.id) {
            const emailId = args.id as string;
            const email = INBOX.find((e) => e.id === emailId);
            setStatuses((prev) => {
              // Mark all others reading→read; mark this one reading
              const next: Record<string, EmailStatus> = {};
              for (const [k, v] of Object.entries(prev)) {
                next[k] = v === 'reading' ? 'read' : v;
              }
              next[emailId] = 'reading';
              return next;
            });
            setCurrentStatus(`📖 Reading: "${email?.subject ?? emailId}" — from ${email?.from ?? '?'}`);
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
            setCurrentStatus(`🎫 Created ${t.type.toUpperCase()} ticket: "${t.title}" (${t.clusterSize} users, ${t.severity})`);
            // Mark cited emails as read
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
              url: `https://github.com/loopback-demo/app/pull/${Math.floor(Math.random() * 900 + 100)}`,
              number: Math.floor(Math.random() * 900 + 100),
              title: args?.title ?? 'Fix',
              ticketId: args?.ticket_id ?? '',
              files: (args?.files_changed as string[]) ?? [],
              additions: (args?.additions as number) ?? 0,
              deletions: (args?.deletions as number) ?? 0,
            };
            setPr(p);
            setCurrentStatus(`🔗 Drafted GitHub PR #${p.number}: "${p.title}"`);
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
            setCurrentStatus(`✅ Done. ${r.emails} emails → ${r.bugs} bugs, ${r.features} features, ${r.questions} questions, ${r.prs} PR${r.prs !== 1 ? 's' : ''}.`);
          }
        },
        onDone: () => {
          setRunning(false);
          // Mark any remaining "reading" emails as "read"
          setStatuses((prev) => {
            const next: Record<string, EmailStatus> = {};
            for (const [k, v] of Object.entries(prev)) {
              next[k] = v === 'reading' ? 'read' : v;
            }
            return next;
          });
        },
        onError: (err) => {
          setRunning(false);
          setCurrentStatus(`⚠️ Error: ${err.message}`);
        },
      },
      conversationIdRef.current,
    );
  }, [running, reset]);

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

      <div className={styles.status}>{currentStatus}</div>

      <main className={styles.grid}>
        <section className={styles.inbox}>
          <div className={styles.panelHeader}>
            <span className={styles.eyebrow}>Inbox</span>
            <span className={styles.count}>{INBOX.length} unread</span>
          </div>
          <div className={styles.emailList}>
            {INBOX.map((e) => (
              <EmailRow key={e.id} email={e} status={statuses[e.id] ?? 'unread'} />
            ))}
          </div>
        </section>

        <section className={styles.artifacts}>
          <div className={styles.panelHeader}>
            <span className={styles.eyebrow}>Artifacts</span>
            <span className={styles.count}>
              {bugCount} bugs · {featCount} features · {qCount} questions
            </span>
          </div>

          <div className={styles.artifactList}>
            {tickets.length === 0 && !pr && (
              <div className={styles.empty}>
                Tickets will appear here as Loopback clusters your inbox.
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

function EmailRow({ email, status }: { email: Email; status: EmailStatus }) {
  const cls = [styles.email, status === 'reading' && styles.emailReading, status === 'read' && styles.emailRead]
    .filter(Boolean).join(' ');
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
