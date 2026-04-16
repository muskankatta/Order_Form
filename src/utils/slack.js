/**
 * Fynd OF Platform — Slack notification utility via Boltic proxy
 * 
 * Architecture:
 * Platform → Boltic HTTP trigger → Slack chat.postMessage (with bot token)
 * 
 * Threading:
 * - First notification for an OF posts to the channel root → Slack returns ts
 * - ts is stored in Firestore as slack_thread_ts on the form document
 * - All subsequent notifications for the same OF pass thread_ts → threaded reply
 */

const BOLTIC_URL = import.meta.env.VITE_BOLTIC_SLACK_URL || '';

const CHANNELS = {
  India:    'C0AQTCE3PNY',
  Global:   'C08CBBNRAKZ',
  'AI/SaaS':'C0978TZNGM8',
};

function getChannel(form) {
  return CHANNELS[form.sales_team] || CHANNELS['India'];
}

/**
 * Post a message via Boltic proxy.
 * Returns the Slack ts if successful, null otherwise.
 */
async function postToSlack({ channel, text, thread_ts }) {
  if (!BOLTIC_URL) { console.warn('VITE_BOLTIC_SLACK_URL not set'); return null; }
  try {
    const body = { channel, text };
    if (thread_ts) body.thread_ts = thread_ts;

    const res  = await fetch(BOLTIC_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    // Boltic returns the Slack API response inside result
    const data = await res.json();
    const slack = data?.result || data;
    if (slack?.ok && slack?.ts) return slack.ts;
    console.warn('Slack post failed:', slack?.error || JSON.stringify(slack));
    return null;
  } catch (e) {
    console.error('Slack error:', e);
    return null;
  }
}

/**
 * Format a Slack message block for an OF event.
 */
function buildMessage(event, form, extra = {}) {
  const ofRef   = form.of_number ? `*${form.of_number}*` : '_Draft_';
  const cust    = form.customer_name || '—';
  const rep     = form.sales_rep_name || '—';
  const url     = `https://muskankatta.github.io/Order_Form/form/${form.id}`;

  const icons = {
    submitted:       '📋',
    revops_approved: '✅',
    revops_rejected: '❌',
    approved:        '🎉',
    signed:          '✍️',
  };
  const labels = {
    submitted:       'Submitted for RevOps review',
    revops_approved: 'RevOps Approved → sent to Finance',
    revops_rejected: 'RevOps Rejected',
    approved:        'Finance Approved',
    signed:          'Marked as Signed',
  };

  const icon  = icons[event]  || '🔔';
  const label = labels[event] || event;

  let text = `${icon} *${label}*\n`;
  text += `• OF: <${url}|${ofRef}> — ${cust}\n`;
  text += `• Sales Rep: ${rep}\n`;

  if (event === 'revops_rejected' && extra.comment) {
    text += `• Reason: _${extra.comment}_\n`;
  }
  if (event === 'approved' && form.of_number) {
    text += `• OF# assigned: ${form.of_number}\n`;
  }
  if (event === 'signed' && form.signed_date) {
    text += `• Signing date: ${form.signed_date}\n`;
  }
  if (form.committed_revenue) {
    text += `• Value: ${form.committed_currency || 'INR'} ${Number(form.committed_revenue).toLocaleString('en-IN')}\n`;
  }

  return text;
}

/**
 * Main notification function.
 * 
 * @param {string}   event    - 'submitted' | 'revops_approved' | 'revops_rejected' | 'approved' | 'signed'
 * @param {object}   form     - the full form object from Firestore
 * @param {object}   extra    - optional extras like { comment }
 * @param {function} onTs     - callback(ts) called with the Slack ts if this is a new thread root
 */
export async function notifySlack(event, form, extra = {}, onTs = null) {
  const channel   = getChannel(form);
  const text      = buildMessage(event, form, extra);
  const thread_ts = form.slack_thread_ts || null;

  const ts = await postToSlack({ channel, text, thread_ts });

  // If this is the first message for this OF (no thread yet), store the ts
  if (ts && !thread_ts && onTs) {
    onTs(ts);
  }

  return ts;
}

export { CHANNELS, getChannel };
