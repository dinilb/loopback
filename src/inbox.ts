/**
 * Frontend mirror of agents/_inbox.ts.
 * Both files must be kept in sync — this is the demo seed data.
 */

export interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
}

export const INBOX: Email[] = [
  { id: 'e01', from: 'sarah@acmecorp.com', subject: "Can't log in on Safari", body: "Hey — the login button on your site does absolutely nothing when I click it in Safari 17. Works fine in Chrome. This is blocking my whole team.", receivedAt: '2026-07-03T09:12:00Z' },
  { id: 'e02', from: 'dev+michael@northline.io', subject: 'Dark mode?', body: "Please please please add dark mode. My eyes are dying at 2am support shifts.", receivedAt: '2026-07-03T09:41:00Z' },
  { id: 'e03', from: 'ops@bluegate.co', subject: 'Safari login broken', body: "Just wanted to flag that login is broken on Safari for us too. Clicking 'Sign in' just spins, no console errors visible.", receivedAt: '2026-07-03T10:03:00Z' },
  { id: 'e04', from: 'finance@peakview.com', subject: 'Pricing for 50 seats?', body: "Hi — we're evaluating Loopback for a 50-person team. Can you send pricing? Your page only shows up to 20 seats.", receivedAt: '2026-07-03T10:19:00Z' },
  { id: 'e05', from: 'anna.k@ridgesoft.dev', subject: 'CSV export takes forever', body: "Exporting our tickets to CSV takes >90 seconds for ~2000 rows. It used to be instant last month. Something regressed.", receivedAt: '2026-07-03T10:35:00Z' },
  { id: 'e06', from: 'james@voltra.app', subject: 'LOVE the new UI!', body: "Just wanted to say the redesign looks fantastic. Feels much more modern. Keep it up 🙌", receivedAt: '2026-07-03T10:44:00Z' },
  { id: 'e07', from: 'pm@harbor.co', subject: 'Bulk delete tickets?', body: "We often need to nuke 100+ spam tickets at once. Right now it's one-by-one. Can you add multi-select + bulk delete?", receivedAt: '2026-07-03T11:02:00Z' },
  { id: 'e08', from: 'ceo@brightlane.io', subject: 'THIS IS UNACCEPTABLE', body: "Your product is a joke. Nothing works. I want a refund. Been a paying customer for 6 months and every day something new is broken.", receivedAt: '2026-07-03T11:16:00Z' },
  { id: 'e09', from: 'melissa@fernpath.co', subject: 'Safari 17 issue', body: "FYI — login form appears frozen on Safari 17.4. My teammates hit the same issue. Chrome is fine.", receivedAt: '2026-07-03T11:30:00Z' },
  { id: 'e10', from: 'ryan.p@northbay.dev', subject: 'Dark theme', body: "Any timeline on a dark theme? Would be huge for late night work.", receivedAt: '2026-07-03T11:47:00Z' },
  { id: 'e11', from: 'hello@pinecrestlabs.com', subject: 'Export slow', body: "The CSV export is painfully slow now. Was <5s last week, is 90+ seconds this week. Anyone else seeing this?", receivedAt: '2026-07-03T12:04:00Z' },
  { id: 'e12', from: 'ops@stonecreek.co', subject: 'Login not working - Safari', body: "Safari users at our company literally cannot sign in. Password manager fills the field, click Sign In, nothing happens. Please fix urgently.", receivedAt: '2026-07-03T12:22:00Z' },
  { id: 'e13', from: 'billing@crestwave.com', subject: 'Enterprise pricing', body: "Interested in your enterprise plan. We need SSO, audit logs, and 200+ seats. Who do I talk to?", receivedAt: '2026-07-03T12:38:00Z' },
  { id: 'e14', from: 'sara@meridianhq.co', subject: 'Please add a night mode', body: "Dark mode would be a game changer. The white background is brutal in the evenings.", receivedAt: '2026-07-03T12:51:00Z' },
  { id: 'e15', from: 'admin@lighthousedata.io', subject: 'Safari 17.4 - sign in broken', body: "5th ticket from us this week — sign-in button on Safari 17.4 does nothing. Team is escalating internally. Need a fix ASAP.", receivedAt: '2026-07-03T13:07:00Z' },
];
