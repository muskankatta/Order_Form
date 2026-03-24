const WEBHOOK = import.meta.env.VITE_SLACK_WEBHOOK_URL;

/** Post a Slack message to the configured webhook.
 *  In production this is a channel webhook; for DMs you'd use the Slack API
 *  with per-user tokens. For Phase 1 we post to a shared channel. */
async function post(text, blocks) {
  if (!WEBHOOK) { console.warn('[Slack] No webhook configured'); return; }
  try {
    await fetch(WEBHOOK, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
    });
  } catch(e) { console.error('[Slack] send failed', e); }
}

const link = (url, label) => url ? `<${url}|${label}>` : label;
const platform = () => window.location.origin + window.location.pathname;

export const notifySubmitted = ({ form, repName }) =>
  post(
    `📋 New OF submitted by ${repName}`,
    [{ type:'section', text:{ type:'mrkdwn',
      text:`*New Order Form submitted*\n*Customer:* ${form.customer_name} — ${form.brand_name}\n*Value:* ${form.committed_currency} ${Number(form.committed_revenue||0).toLocaleString('en-IN')}\n*Submitted by:* ${repName}\n*SoW uploaded:* ${form.sow_document ? 'Yes ✓' : 'No ✗'}\n*Action required:* Review & Approve\n${link(platform(),'Open in platform')}`
    }}]
  );

export const notifyRevOpsApproved = ({ form, revopsName }) =>
  post(
    `✅ OF ready for Finance approval`,
    [{ type:'section', text:{ type:'mrkdwn',
      text:`*OF ready for Finance approval*\n*Customer:* ${form.customer_name}\n*Value:* ${form.committed_currency} ${Number(form.committed_revenue||0).toLocaleString('en-IN')}\n*Reviewed by:* ${revopsName}\n*Action required:* Assign OF# & Approve\n${link(platform(),'Open in platform')}`
    }}]
  );

export const notifyFinanceApproved = ({ form }) =>
  post(
    `🎉 Your OF has been approved!`,
    [{ type:'section', text:{ type:'mrkdwn',
      text:`*Your Order Form has been approved!*\n*OF#:* ${form.of_number}\n*Customer:* ${form.customer_name}\n*Value:* ${form.committed_currency} ${Number(form.committed_revenue||0).toLocaleString('en-IN')}\n${link(platform(),'Download PDF')}`
    }}]
  );

export const notifyRejected = ({ form, comment, reviewerName }) =>
  post(
    `❌ OF rejected`,
    [{ type:'section', text:{ type:'mrkdwn',
      text:`*Order Form rejected*\n*Customer:* ${form.customer_name}\n*Rejected by:* ${reviewerName}\n*Reason:* ${comment || 'No comment provided'}\nPlease revise and resubmit.\n${link(platform(),'Open in platform')}`
    }}]
  );

export const notifyChurnVoidRequest = ({ form, requesterName, statusRequested, churnValue, reason }) =>
  post(
    `⚠️ Churn/Void request filed`,
    [{ type:'section', text:{ type:'mrkdwn',
      text:`*Churn/Void Request*\n*Requested by:* ${requesterName}\n*Client:* ${form.customer_name}\n*OF#:* ${form.of_number || 'N/A'}\n*Status requested:* ${statusRequested}\n${churnValue ? `*Churn amount:* ${churnValue}\n` : ''}*Reason:* ${reason || 'N/A'}\n${link(platform(),'Review in platform')}`
    }}]
  );

export const notifyRenewalReminder = ({ form, daysLeft }) =>
  post(
    `🔔 Renewal reminder: ${form.customer_name}`,
    [{ type:'section', text:{ type:'mrkdwn',
      text:`*Renewal/Expiry Reminder*\n*Customer:* ${form.customer_name}\n*OF#:* ${form.of_number}\n*Date:* ${form.end_date}\n*Days remaining:* ${daysLeft}\n${link(platform(),'Open in platform')}`
    }}]
  );
