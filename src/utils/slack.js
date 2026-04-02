function getWebhook() {
  try {
    const s = JSON.parse(localStorage.getItem('fynd_of_settings') || '{}');
    return s.slackWebhook || import.meta.env.VITE_SLACK_WEBHOOK_URL || '';
  } catch {
    return import.meta.env.VITE_SLACK_WEBHOOK_URL || '';
  }
}

async function post(text, blocks) {
  const WEBHOOK = getWebhook();
  if (!WEBHOOK || WEBHOOK === 'placeholder') {
    console.warn('[Slack] No webhook configured. Go to Settings to add one.');
    return;
  }
  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
    });
  } catch(e) { console.error('[Slack] send failed', e); }
}

const platform = () => window.location.origin + window.location.pathname;

const primaryLabel = (approvers, users) => {
  if (!approvers?.length) return 'Unassigned';
  const primary = users?.find(u => u.email === approvers[0]);
  return primary?.name || approvers[0];
};

const ccLabel = (approvers, users) => {
  if (!approvers || approvers.length <= 1) return '';
  const cc = approvers.slice(1).map(e => {
    const u = users?.find(x => x.email === e);
    return u?.name || e;
  }).join(', ');
  return cc ? `\n*CC:* ${cc}` : '';
};

export const notifySubmitted = ({ form, repName, revopsUsers }) =>
  post(`📋 New OF submitted by ${repName}`, [{
    type: 'section', text: { type: 'mrkdwn',
      text: `*New Order Form submitted*\n*Customer:* ${form.customer_name} — ${form.brand_name}\n*Value:* ${form.committed_currency} ${Number(form.committed_revenue||0).toLocaleString('en-IN')}\n*Submitted by:* ${repName}\n*Primary RevOps DRI:* ${primaryLabel(form.revops_approvers, revopsUsers)}${ccLabel(form.revops_approvers, revopsUsers)}\n*SoW uploaded:* ${form.sow_document ? 'Yes ✓' : 'No ✗'}\n<${platform()}|Open in platform>`
    }
  }]);

export const notifyRevOpsApproved = ({ form, revopsName, financeUsers }) =>
  post(`✅ OF ready for Finance approval`, [{
    type: 'section', text: { type: 'mrkdwn',
      text: `*OF ready for Finance approval*\n*Customer:* ${form.customer_name}\n*Value:* ${form.committed_currency} ${Number(form.committed_revenue||0).toLocaleString('en-IN')}\n*Reviewed by:* ${revopsName}\n*Primary Finance DRI:* ${primaryLabel(form.finance_approvers, financeUsers)}${ccLabel(form.finance_approvers, financeUsers)}\n<${platform()}|Open in platform>`
    }
  }]);

export const notifyFinanceApproved = ({ form }) =>
  post(`🎉 Your OF has been approved!`, [{
    type: 'section', text: { type: 'mrkdwn',
      text: `*Your Order Form has been approved!*\n*OF#:* ${form.of_number}\n*Customer:* ${form.customer_name}\n*Value:* ${form.committed_currency} ${Number(form.committed_revenue||0).toLocaleString('en-IN')}\n<${platform()}|Download PDF>`
    }
  }]);

export const notifyRejected = ({ form, comment, reviewerName }) =>
  post(`❌ OF rejected`, [{
    type: 'section', text: { type: 'mrkdwn',
      text: `*Order Form rejected*\n*Customer:* ${form.customer_name}\n*Rejected by:* ${reviewerName}\n*Reason:* ${comment || 'No comment provided'}\n<${platform()}|Open in platform>`
    }
  }]);

export const notifyChurnVoidRequest = ({ form, requesterName, statusRequested, churnValue, reason }) =>
  post(`⚠️ Churn/Void request filed`, [{
    type: 'section', text: { type: 'mrkdwn',
      text: `*Churn/Void Request*\n*Requested by:* ${requesterName}\n*Client:* ${form.customer_name}\n*OF#:* ${form.of_number || 'N/A'}\n*Status requested:* ${statusRequested}\n${churnValue ? `*Churn amount:* ${churnValue}\n` : ''}*Reason:* ${reason || 'N/A'}\n<${platform()}|Review in platform>`
    }
  }]);

export const notifyRenewalReminder = ({ form, daysLeft }) =>
  post(`🔔 Renewal reminder: ${form.customer_name}`, [{
    type: 'section', text: { type: 'mrkdwn',
      text: `*Renewal/Expiry Reminder*\n*Customer:* ${form.customer_name}\n*OF#:* ${form.of_number}\n*End date:* ${form.end_date}\n*Days remaining:* ${daysLeft}\n<${platform()}|Open in platform>`
    }
  }]);
