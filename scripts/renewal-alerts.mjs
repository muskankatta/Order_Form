/**
 * Renewal alerts — runs daily via GitHub Actions (.github/workflows/renewal-alerts.yml).
 *
 * Posts a ONE-TIME Slack message to the OF's team channel ~30 days before an
 * auto-renewing signed OF reaches its end date, tagging the Sales Rep, RA and RevOps.
 * Each OF is stamped `renewal_alert_sent` so it is never pinged twice.
 *
 * Reads Firestore directly with the same client config the app uses (open rules),
 * so no service account is needed — only the Vite secrets already in the repo.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
};
const BOLTIC_URL = process.env.VITE_BOLTIC_SLACK_URL;

// Keep in sync with src/utils/slack.js (team channels)
const CHANNELS = { India: 'C0978TZNGM8', Global: 'C0978TZNGM8', RJW: 'C0B18PJMKJP' };
// Keep in sync with src/constants/users.js REVOPS_USERS (non-universal)
const REVOPS = [
  { slack: 'U07PSSKJG48', team: 'India'  }, // Samiksha Mane
  { slack: 'U01T33X34UU', team: 'India'  }, // Jay Karia
  { slack: 'U018REY8UA2', team: 'Global' }, // Nayan Lathiya
  { slack: 'U01T138DQAF', team: 'India'  }, // Atharva Shetye
];

// Fire within a small window around the 30-day mark so a skipped cron run still
// catches it; the `renewal_alert_sent` flag guarantees exactly one ping per OF.
const WINDOW_MIN = 28;
const WINDOW_MAX = 30;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  if (isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end - today) / 86400000);
}

async function post(channel, text) {
  try {
    const res = await fetch(BOLTIC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, text }),
    });
    return res.ok;
  } catch (e) {
    console.warn('Slack post error:', e?.message || e);
    return false;
  }
}

async function main() {
  if (!BOLTIC_URL) { console.error('VITE_BOLTIC_SLACK_URL missing'); process.exit(1); }
  if (!firebaseConfig.projectId) { console.error('Firebase config missing'); process.exit(1); }

  const db = getFirestore(initializeApp(firebaseConfig));
  const snap = await getDocs(collection(db, 'order_forms'));

  let scanned = 0, sent = 0;
  for (const d of snap.docs) {
    const f = { id: d.id, ...d.data() };
    scanned++;
    if (f.status !== 'signed') continue;          // only active signed contracts
    if (f.auto_renewal !== 'Yes') continue;       // only due-for-renewal (auto-renew)
    if (f.renewal_alert_sent) continue;           // already pinged
    const dd = daysUntil(f.end_date);
    if (dd === null || dd < WINDOW_MIN || dd > WINDOW_MAX) continue;

    const channel = CHANNELS[f.sales_team] || CHANNELS.India;
    const repTag = f.slack_id ? `<@${f.slack_id}>` : (f.sales_rep_name || '—');
    const raTag = (f.ra_email && f.ra_email !== 'NA')
      ? (f.ra_slack_id ? `<@${f.ra_slack_id}>` : (f.ra_name || null))
      : null;
    const revopsScoped = REVOPS.filter(r => r.team === f.sales_team);
    const revopsTags = (revopsScoped.length ? revopsScoped : REVOPS).map(r => `<@${r.slack}>`).join(' ');

    let text = `🔄 *Renewal due in 30 days* — ${f.customer_name} · *${f.of_number}*\n`;
    text += `• Renews on: ${f.end_date}\n`;
    text += `• Sales Rep: ${repTag}`;
    if (raTag) text += `   ·   RA: ${raTag}`;
    text += `\n• RevOps: ${revopsTags}\n`;
    if (f.committed_revenue) {
      text += `• Value: ${f.committed_currency || 'INR'} ${Number(f.committed_revenue).toLocaleString('en-IN')}\n`;
    }
    text += `\n_Pls initiate conversation to renegotiate or we shall automatically increase 8% commercials as per applicable clauses._`;

    const ok = await post(channel, text);
    if (ok) {
      await updateDoc(doc(db, 'order_forms', f.id), {
        renewal_alert_sent: true,
        renewal_alert_sent_at: new Date().toISOString(),
      });
      sent++;
      console.log(`✓ Alerted ${f.of_number} (${dd}d → ${f.end_date}) on ${channel}`);
    } else {
      console.warn(`✗ Slack post failed for ${f.of_number} — will retry next run`);
    }
  }

  console.log(`Done. Scanned ${scanned} OFs, sent ${sent} renewal alert(s).`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
