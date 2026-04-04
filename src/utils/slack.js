/**
 * Slack notifications via Mogambo bot (chat.postMessage)
 * All updates for an OF are threaded under the first submission message.
 * The thread ts is stored on the form as slack_thread_ts.
 */

import { SALES_REPS, REVOPS_USERS, FINANCE_USERS } from '../constants/users.js';

const BOT_TOKEN = import.meta.env.VITE_SLACK_BOT_TOKEN || '';

const TEAM_CHANNELS = {
  'India':   'C0AQTCE3PNY',
  'Global':  'C08CBBNRAKZ',
  'AI/SaaS': 'C0978TZNGM8',
};
const DEFAULT_CHANNEL = 'C0AQTCE3PNY';

function getChannel(salesTeam) {
  return TEAM_CHANNELS[salesTeam] || DEFAULT_CHANNEL;
}

function getWebhook() {
  try {
    const s = JSON.parse(localStorage.getItem('fynd_of_settings') || '{}');
    return s.slackWebhook || import.meta.env.VITE_SLACK_WEBHOOK_URL || '';
  } catch { return ''; }
}

// ── TAG HELPERS ───────────────────────────────────────────────────────────────
function slackTag(email) {
  if (!email) return '—';
  const allUsers = [...SALES_REPS, ...REVOPS_USERS, ...FINANCE_USERS];
  const u = allUsers.find(u => u.email === email);
  return u?.slack ? `<@${u.slack}>` : email;
}

function tagList(emails = []) {
  if (!emails.length) return '—';
  return emails.map(slackTag).join(' ');
}

function svcSummary(form) {
  return (form.services_fees || []).map(s => s.name).filter(Boolean).join(', ') || '—';
}

function valueLine(form) {
  const v = Number(form.committed_revenue || 0);
  return v ? `${form.committed_currency || 'INR'} ${v.toLocaleString('en-IN')}` : '—';
}

const platform = () => window.location.origin + window.location.pathname;

// ── POST via Mogambo bot ──────────────────────────────────────────────────────
/**
 * Post a message. Returns the ts (thread timestamp) on success.
 * Pass thread_ts to reply in a thread.
 */
async function postBot(channel, text, blocks, thread_ts) {
  if (true || !BOT_TOKEN) {
    // Fallback to webhook (no threading support)
    const WEBHOOK = getWebhook();
    if (!WEBHOOK || WEBHOOK === 'placeholder') {
      console.warn('[Slack] No bot token or webhook configured.');
      return null;
    }
   try {
  await fetch(WEBHOOK, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...(blocks ? { blocks } : {}) }),
  });
} catch(e) { console.error('[Slack] webhook failed:', e); }
return null;
  try {
    const payload = {
      channel,
      text,
      ...(blocks ? { blocks } : {}),
      unfurl_links: false,
      ...(thread_ts ? { thread_ts } : {}),
    };
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${BOT_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('[Slack] postMessage error:', data.error);
      return null;
    }
    // Return ts so it can be stored as thread anchor
    return data.ts || null;
  } catch(e) {
    console.error('[Slack] fetch failed:', e);
    return null;
  }
}

function buildBlocks(headerText, fields, footer) {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: headerText, emoji: true },
    },
    {
      type: 'section',
      fields: fields.map(([label, value]) => ({
        type: 'mrkdwn',
        text: `*${label}*\n${value || '—'}`,
      })),
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: footer }],
    },
  ];
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

/**
 * Called when Sales submits.
 * Posts the first message and returns { channel, ts } to be stored on the form.
 */
export const notifySubmitted = async ({ form, repName }) => {
  const channel    = getChannel(form.sales_team);
  const primary    = form.revops_approvers?.[0];
  const ccEmails   = (form.revops_approvers || []).slice(1);
  const repTag     = slackTag(form.sales_rep_email);

  const text = `📋 New Order Form submitted — ${form.customer_name}`;
  const blocks = buildBlocks(
    '📋 New Order Form Submitted',
    [
      ['Customer',        form.customer_name],
      ['Brand',           form.brand_name || '—'],
      ['Services',        svcSummary(form)],
      ['Committed Value', valueLine(form)],
      ['Sales Rep',       repTag],
      ['Sales Team',      form.sales_team || '—'],
      ['RevOps DRI',      `${slackTag(primary)} *(Primary)*${ccEmails.length ? `  CC: ${tagList(ccEmails)}` : ''}`],
      ['SoW uploaded',    form.sow_document ? 'Yes ✓' : 'No ✗'],
    ],
    `<${platform()}|Open in platform> · ${new Date().toLocaleDateString('en-IN')}`
  );

  const ts = await postBot(channel, text, blocks);
  // Return channel + ts so FormsContext can store it on the form
  return ts ? { slack_channel: channel, slack_thread_ts: ts } : null;
};

/**
 * RevOps approves → reply in thread.
 */
export const notifyRevOpsApproved = async ({ form, revopsName }) => {
  const channel    = getChannel(form.sales_team);
  const primary    = form.finance_approvers?.[0];
  const ccEmails   = (form.finance_approvers || []).slice(1);
  const repTag     = slackTag(form.sales_rep_email);
  const threadTs   = form.slack_thread_ts;

  const text = `✅ RevOps approved — ready for Finance: ${form.customer_name}`;
  const blocks = buildBlocks(
    '✅ Approved by RevOps — Pending Finance',
    [
      ['Customer',        form.customer_name],
      ['Services',        svcSummary(form)],
      ['Committed Value', valueLine(form)],
      ['Sales Rep',       repTag],
      ['Reviewed by',     revopsName],
      ['Finance DRI',     `${slackTag(primary)} *(Primary)*${ccEmails.length ? `  CC: ${tagList(ccEmails)}` : ''}`],
    ],
    `<${platform()}|Open in platform> · ${new Date().toLocaleDateString('en-IN')}`
  );

  await postBot(channel, text, blocks, threadTs);
};

/**
 * Finance approves → reply in thread.
 */
export const notifyFinanceApproved = async ({ form }) => {
  const channel    = getChannel(form.sales_team);
  const repTag     = slackTag(form.sales_rep_email);
  const revopsTags = tagList(form.revops_approvers || []);
  const threadTs   = form.slack_thread_ts;

  const text = `🎉 Finance approved! OF# ${form.of_number} — ${form.customer_name}`;
  const blocks = buildBlocks(
    '🎉 Order Form Approved!',
    [
      ['OF Number',       form.of_number],
      ['Customer',        form.customer_name],
      ['Services',        svcSummary(form)],
      ['Committed Value', valueLine(form)],
      ['Sales Rep',       repTag],
      ['RevOps',          revopsTags],
      ['Approved by',     form.finance_approver || '—'],
    ],
    `<${platform()}|Download PDF> · ${new Date().toLocaleDateString('en-IN')}`
  );

  await postBot(channel, text, blocks, threadTs);
};

/**
 * Rejection → reply in thread.
 */
export const notifyRejected = async ({ form, comment, reviewerName }) => {
  const channel  = getChannel(form.sales_team);
  const repTag   = slackTag(form.sales_rep_email);
  const threadTs = form.slack_thread_ts;

  const text = `❌ Order Form rejected — ${form.customer_name}`;
  const blocks = buildBlocks(
    '❌ Order Form Rejected',
    [
      ['Customer',    form.customer_name],
      ['Services',    svcSummary(form)],
      ['Sales Rep',   repTag],
      ['Rejected by', reviewerName],
      ['Reason',      comment || 'No comment provided'],
    ],
    `<${platform()}|Open in platform to resubmit> · ${new Date().toLocaleDateString('en-IN')}`
  );

  await postBot(channel, text, blocks, threadTs);
};

/**
 * Churn/Void request → new message (not threaded — different context).
 */
export const notifyChurnVoidRequest = async ({ form, requesterName, statusRequested, churnValue, reason }) => {
  const channel      = getChannel(form.sales_team);
  const requesterTag = [...REVOPS_USERS, ...FINANCE_USERS]
    .find(u => u.name === requesterName);

  const text = `⚠️ ${statusRequested} request — ${form.customer_name}`;
  const blocks = buildBlocks(
    `⚠️ ${statusRequested} Request Filed`,
    [
      ['Customer',         form.customer_name],
      ['OF Number',        form.of_number || 'N/A'],
      ['Status requested', statusRequested],
      ['Churn amount',     churnValue || '—'],
      ['Reason',           reason || '—'],
      ['Filed by',         requesterTag ? slackTag(requesterTag.email) : requesterName],
    ],
    `<${platform()}|Review in Signed OFs → Churn/Void Requests>`
  );

  await postBot(channel, text, blocks);
};

/**
 * Renewal reminder → reply in thread if available, else new message.
 */
export const notifyRenewalReminder = async ({ form, daysLeft }) => {
  const channel  = getChannel(form.sales_team);
  const repTag   = slackTag(form.sales_rep_email);
  const threadTs = form.slack_thread_ts;

  const text = `🔔 Contract renewing in ${daysLeft} days — ${form.customer_name}`;
  const blocks = buildBlocks(
    '🔔 Contract Renewal Reminder',
    [
      ['Customer',  form.customer_name],
      ['OF Number', form.of_number],
      ['End Date',  form.end_date],
      ['Days left', String(daysLeft)],
      ['Sales Rep', repTag],
      ['Services',  svcSummary(form)],
    ],
    `<${platform()}|Open in platform>`
  );

  await postBot(channel, text, blocks, threadTs);
};
