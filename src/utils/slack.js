/**
 * Fynd OF Platform — Slack notification utility via Boltic proxy
 */

const BOLTIC_URL = import.meta.env.VITE_BOLTIC_SLACK_URL || '';

const CHANNELS = {
  India:    'C0AQTCE3PNY',
  Global:   'C08CBBNRAKZ',
  'AI/SaaS':'C0978TZNGM8',
};

const SLACK_IDS = {
  'abhishekdalvi@gofynd.com':   'U0A6WDTN1K7',
  'anshuman@gofynd.com':        'U0AD7ENHY04',
  'ashutoshrai@gofynd.com':     'U02NN4RG6JY',
  'divyakumari@gofynd.com':     'U046S3KCEMR',
  'gauravbole@gofynd.com':      'UD51MCZT5',
  'hemantgupta@gofynd.com':     'U09D0KS8MGU',
  'kedarkulkarni@gofynd.com':   'U0332TP5GTY',
  'kunalkumar@gofynd.com':      'URU3PEGN6',
  'manishupadhyay@gofynd.com':  'U089C7U3DAN',
  'poojadwivedi@gofynd.com':    'U02CHLEB3LG',
  'praveensharma1@gofynd.com':  'U0918EEFUKS',
  'premraja@gofynd.com':        'U04J0CW9XRA',
  'rakeshjaiswal@gofynd.com':   'U074JJV27GW',
  'shireenahmed@gofynd.com':    'U094CCGLYFM',
  'shwetalamba@gofynd.com':     'U03PXBAHU68',
  'swatigupta1@gofynd.com':     'U09EK4RG31B',
  'vaibhavp@gofynd.com':        'U03RT8TJY74',
  'yadvendrasingh@gofynd.com':  'U072WEB2TGS',
  'yugandharhode@gofynd.com':   'U03LWJWJXEY',
  'ninadmandavkar@gofynd.com':  'U0764AWNYKX',
  'dharmendra@gofynd.com':      'U07KGJ8MTUK',
  'nayanlathiya@gofynd.com':    'U018REY8UA2',
  'rushabhmehta1@gofynd.com':   'U08F74BT57E',
  'visheshkumar@gofynd.com':    'UFJ0SDTLH',
  'yazdanirani@gofynd.com':     'U048V9AHNA3',
  'evaniroutray@gofynd.com':    'U05SCN10HJ4',
  'harshkumar@gofynd.com':      'U09Q11L8E6Q',
  'komalkarani@gofynd.com':     'U092K3NU18S',
  'novri@fynd.team':            'U07KA2RMW0N',
  'ronakmodi@gofynd.com':       'U0BDD4119',
  'vipulaggarwal@gofynd.com':   'U099PMC6FNV',
  'shubhamsoni@gofynd.com':     'U09D0KUAG76',
  'deepjindal@gofynd.com':      'U09D0KZV2A0',
  'faizanansari@gofynd.com':    'U08N41VP4JW',
  'jatinjindal@gofynd.com':     'U08R9EXEW7J',
  'saritharavi@gofynd.com':     'U08N41SD8F4',
  'shresthgupta@gofynd.com':    'U09R6079V9N',
  'samikshamane@gofynd.com':    'U07PSSKJG48',
  'raginivarma@gofynd.com':     'U4E0RBPJ6',
  'atharvashetye@gofynd.com':   'U01T138DQAF',
  'omkarsp@gofynd.com':         'U05PRTA46CT',
  'muskankatta2@gofynd.com':    'U08AB8PBFPC',
  'rahulmandowara@gofynd.com':  'U01J8GPUFND',
  'abhimanyumallik@gofynd.com': 'U29S6QR7F',
  'rasikajadhav@gofynd.com':    'UE1UUAHLK',
  'somaydugar@gofynd.com':      'U07H3FK41U0',
  'vikysangoi@gofynd.com':      'U3JUC5YNS',
  'roshanimohan@gofynd.com':    'UBZ21KS66',
};

function slackMention(email) {
  const id = SLACK_IDS[email];
  return id ? `<@${id}>` : null;
}

function getChannel(form) {
  return CHANNELS[form.sales_team] || CHANNELS['India'];
}

async function postToSlack({ channel, text, thread_ts }) {
  if (!BOLTIC_URL) { console.warn('VITE_BOLTIC_SLACK_URL not set'); return null; }
  try {
    // Send thread_ts as query param so Boltic can access it via trigger.query_params
    const params = new URLSearchParams({ channel, text });
    if (thread_ts) params.append('thread_ts', thread_ts);
    const url = `${BOLTIC_URL}?${params.toString()}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, text }),
    });

    const data = await res.json();
    const slack = data?.result || data;
    if (slack?.ok && slack?.ts) return slack.ts;
    console.warn('Slack post failed:', JSON.stringify(slack));
    return null;
  } catch (e) {
    console.error('Slack error:', e);
    return null;
  }
}

function buildMessage(event, form, extra = {}) {
  const ofRef = form.of_number ? `*${form.of_number}*` : '_Draft_';
  const cust  = form.customer_name || '—';
  const url   = `https://muskankatta.github.io/Order_Form/#/form/${form.id}`;
  const repMention = slackMention(form.sales_rep_email) || form.sales_rep_name || '—';

  const icons  = { submitted:'📋', revops_approved:'✅', revops_rejected:'❌', approved:'🎉', signed:'✍️' };
  const labels = {
    submitted:       'Submitted for RevOps review',
    revops_approved: 'RevOps Approved → sent to Finance',
    revops_rejected: 'RevOps Rejected',
    approved:        'Finance Approved',
    signed:          'Marked as Signed',
  };

  let text = `${icons[event]||'🔔'} *${labels[event]||event}*\n`;
  text += `• OF: <${url}|${ofRef}> — ${cust}\n`;
  text += `• Sales Rep: ${repMention}\n`;

  if (event === 'submitted' && form.revops_approvers?.length) {
    const tags = form.revops_approvers.map(e => slackMention(e) || e).join(', ');
    text += `• RevOps: ${tags}\n`;
  }
  if (event === 'revops_approved' && form.finance_approvers?.length) {
    const tags = form.finance_approvers.map(e => slackMention(e) || e).join(', ');
    text += `• Finance: ${tags}\n`;
  }
  if (event === 'revops_rejected' && extra.comment) text += `• Reason: _${extra.comment}_\n`;
  if (event === 'approved' && form.of_number)        text += `• OF# assigned: ${form.of_number}\n`;
  if (event === 'signed' && form.signed_date)        text += `• Signing date: ${form.signed_date}\n`;
  if (form.committed_revenue) {
    text += `• Value: ${form.committed_currency||'INR'} ${Number(form.committed_revenue).toLocaleString('en-IN')}\n`;
  }
  return text;
}

export async function notifySlack(event, form, extra = {}, onTs = null) {
  const channel   = getChannel(form);
  const text      = buildMessage(event, form, extra);
  const thread_ts = form.slack_thread_ts || null;

  const ts = await postToSlack({ channel, text, thread_ts });
  if (ts && !thread_ts && onTs) onTs(ts);
  return ts;
}

export { CHANNELS, getChannel, slackMention };
