/**
 * Slack notifications via Mogambo bot (chat.postMessage)
 * Routes to team-specific channels based on form.sales_team
 * Falls back to incoming webhook if bot token not configured
 */

import { SALES_REPS, REVOPS_USERS, FINANCE_USERS } from '../constants/users.js';

// ── CONFIG ────────────────────────────────────────────────────────────────────
const BOT_TOKEN = import.meta.env.VITE_SLACK_BOT_TOKEN || '';

const TEAM_CHANNELS = {
  'India':   'C0AQTCE3PNY',
  'Global':  'C08CBBNRAKZ',
  'AI/SaaS': 'C0978TZNGM8',
};
const DEFAULT_CHANNEL = 'C0AQTCE3PNY'; // India as fallback

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
  const allUsers = [...SALES_REPS, ...REVOPS_USERS, ...FINANCE_USERS];
  const u = allUsers.find(u => u.email === email);
  return u?.slack ? `<@${u.slack}>` : email;
}

function tagList(emails = []) {
  return emails.map(slackTag).join(' ');
}

function svcSummary(form) {
  const svcs = (form.services_fees || []).map(s => s.name).filter(Boolean);
  return svcs.length ? svcs.join(', ') : '—';
}

function valueLine(form) {
  const v = Number(form.committed_revenue || 0);
  return v ? `${form.committed_currency || 'INR'} ${v.toLocaleString('en-IN')}` : '—';
}

const platform = () => window.location.origin + window.location.pathname;

// ── POST ──────────────────────────────────────────────────────────────────────
async function postBot(channel, text, blocks) {
  if (!BOT_TOKEN) {
    console.warn('[Slack] No bot token — falling back to webhook');
    return postWebhook(text, blocks);
  }
  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${BOT_TOKEN}`,
      },
      body: JSON.stringify({
        channel,
        text,
        ...(blocks ? { blocks } : {}),
        unfurl_links: false,
      }),
    });
    const data = await res.json();
    if (!data.ok) console.error('[Slack] postMessage error:', data.error);
    return data;
  } catch(e) { console.error('[Slack] fetch failed:', e); }
}

async function postWebhook(text, blocks) {
  const WEBHOOK = getWebhook();
  if (!WEBHOOK || WEBHOOK === 'placeholder') {
    console.warn('[Slack] No webhook configured.');
    return;
  }
  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
    });
  } catch(e) { console.error('[Slack] webhook failed:', e); }
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

/** Sales submits → notify RevOps primary DRI on team channel */
export const notifySubmitted = ({ form, repName }) => {
  const channel  = getChannel(form.sales_team);
  const revopsTags = tagList(form.revops_approvers || []);
  const repTag    = slackTag(form.sales_rep_email);
  const primary   = form.revops_approvers?.[0];
  const primaryUser = REVOPS_USERS.find(u => u.email === primary);
  const ccEmails  = (form.revops_approvers || []).slice(1);

  const text = `📋 New Order Form submitted by ${repName} — ${form.customer_name}`;
  const blocks = buildBlocks(
    '📋 New Order Form Submitted',
    [
      ['Customer',          form.customer_name],
      ['Brand',             form.brand_name || '—'],
      ['Services',          svcSummary(form)],
      ['Committed Value',   valueLine(form)],
      ['Sales Rep',         repTag],
      ['Sales Team',        form.sales_team || '—'],
      ['Assigned to',       `${slackTag(primary)} *(Primary DRI)*${ccEmails.length ? `\nCC: ${tagList(ccEmails)}` : ''}`],
      ['SoW uploaded',      form.sow_document ? 'Yes ✓' : 'No ✗'],
    ],
    `<${platform()}|Open in platform> · ${new Date().toLocaleDateString('en-IN')}`
  );
  return postBot(channel, text, blocks);
};

/** RevOps approves → notify Finance primary DRI on team channel */
export const notifyRevOpsApproved = ({ form, revopsName }) => {
  const channel = getChannel(form.sales_team);
  const primary = form.finance_approvers?.[0];
  const ccEmails = (form.finance_approvers || []).slice(1);
  const repTag   = slackTag(form.sales_rep_email);

  const text = `✅ OF approved by RevOps — ready for Finance: ${form.customer_name}`;
  const blocks = buildBlocks(
    '✅ Order Form Ready for Finance Approval',
    [
      ['Customer',        form.customer_name],
      ['Services',        svcSummary(form)],
      ['Committed Value', valueLine(form)],
      ['Sales Rep',       repTag],
      ['Reviewed by',     revopsName],
      ['Finance DRI',     `${slackTag(primary)} *(Primary DRI)*${ccEmails.length ? `\nCC: ${tagList(ccEmails)}` : ''}`],
    ],
    `<${platform()}|Open in platform> · ${new Date().toLocaleDateString('en-IN')}`
  );
  return postBot(channel, text, blocks);
};

/** Finance approves → notify Sales Rep + RevOps on team channel */
export const notifyFinanceApproved = ({ form }) => {
  const channel  = getChannel(form.sales_team);
  const repTag   = slackTag(form.sales_rep_email);
  const revopsTags = tagList(form.revops_approvers || []);

  const text = `🎉 Order Form approved! OF# ${form.of_number} — ${form.customer_name}`;
  const blocks = buildBlocks(
    '🎉 Order Form Approved!',
    [
      ['OF Number',       form.of_number],
      ['Customer',        form.customer_name],
      ['Services',        svcSummary(form)],
      ['Committed Value', valueLine(form)],
      ['Sales Rep',       repTag],
      ['RevOps',          revopsTags || '—'],
      ['Approved by',     slackTag(form.finance_approver ? FINANCE_USERS.find(u=>u.name===form.finance_approver)?.email : '') || form.finance_approver || '—'],
    ],
    `<${platform()}|Download PDF> · ${new Date().toLocaleDateString('en-IN')}`
  );
  return postBot(channel, text, blocks);
};

/** Rejection → notify Sales Rep on team channel */
export const notifyRejected = ({ form, comment, reviewerName }) => {
  const channel = getChannel(form.sales_team);
  const repTag  = slackTag(form.sales_rep_email);

  const text = `❌ Order Form rejected — ${form.customer_name}`;
  const blocks = buildBlocks(
    '❌ Order Form Rejected',
    [
      ['Customer',     form.customer_name],
      ['Services',     svcSummary(form)],
      ['Sales Rep',    repTag],
      ['Rejected by',  reviewerName],
      ['Reason',       comment || 'No comment provided'],
    ],
    `<${platform()}|Open in platform to resubmit> · ${new Date().toLocaleDateString('en-IN')}`
  );
  return postBot(channel, text, blocks);
};

/** Churn/Void request → notify Finance DRIs on team channel */
export const notifyChurnVoidRequest = ({ form, requesterName, statusRequested, churnValue, reason }) => {
  const channel      = getChannel(form.sales_team);
  const requesterTag = REVOPS_USERS.find(u => u.name === requesterName)
    ? slackTag(REVOPS_USERS.find(u => u.name === requesterName)?.email)
    : requesterName;

  const text = `⚠️ ${statusRequested} request filed — ${form.customer_name}`;
  const blocks = buildBlocks(
    `⚠️ ${statusRequested} Request Filed`,
    [
      ['Customer',          form.customer_name],
      ['OF Number',         form.of_number || 'N/A'],
      ['Status requested',  statusRequested],
      ['Churn amount',      churnValue || '—'],
      ['Reason',            reason || '—'],
      ['Filed by',          requesterTag],
    ],
    `<${platform()}|Review in Signed OFs → Churn/Void Requests>`
  );
  return postBot(channel, text, blocks);
};

/** Renewal reminder */
export const notifyRenewalReminder = ({ form, daysLeft }) => {
  const channel = getChannel(form.sales_team);
  const repTag  = slackTag(form.sales_rep_email);

  const text = `🔔 Contract renewing in ${daysLeft} days — ${form.customer_name}`;
  const blocks = buildBlocks(
    '🔔 Contract Renewal Reminder',
    [
      ['Customer',   form.customer_name],
      ['OF Number',  form.of_number],
      ['End Date',   form.end_date],
      ['Days left',  String(daysLeft)],
      ['Sales Rep',  repTag],
      ['Services',   svcSummary(form)],
    ],
    `<${platform()}|Open in platform>`
  );
  return postBot(channel, text, blocks);
};
