import { useState } from 'react';
import { Card, Btn, Inp, Toast } from '../ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { syncAllToSheets } from '../../utils/sheets.js';

const NAVY = '#1B2B4B'; const T = '#00C3B5';
const LS_KEY = 'fynd_of_settings';

const BOT_TOKEN = import.meta.env.VITE_SLACK_BOT_TOKEN || '';

const TEAM_CHANNELS = {
  'India':   { id: 'C0AQTCE3PNY',  label: '#india-channel' },
  'Global':  { id: 'C08CBBNRAKZ',  label: '#global-channel' },
  'AI/SaaS': { id: 'C0978TZNGM8',  label: '#aisaas-channel' },
};

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
export function saveSettings(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

export default function Settings() {
  const { user }  = useAuth();
  const { forms } = useForms();
  const { toast, show, hide } = useToast();
  const [settings, setSettings] = useState(loadSettings);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncing,    setSyncing]    = useState(false);
  const [channelTestStatus, setChannelTestStatus] = useState('');
  const [channelTesting,    setChannelTesting]    = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState('');

  if (!user?.isUniversal) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-3">🔒</div>
          <p className="font-semibold" style={{ color:NAVY }}>Universal access required</p>
        </div>
      </div>
    );
  }

  const u = (k, v) => setSettings(s => ({ ...s, [k]: v }));
  const handleSave = () => { saveSettings(settings); show('Settings saved ✓'); };

  // ── Test webhook (fallback path) ─────────────────────────────────────────
  const testWebhook = async () => {
    if (!settings.slackWebhook) { alert('Enter a webhook URL first.'); return; }
    setWebhookTestStatus('sending');
    try {
      await fetch(settings.slackWebhook, {
        method: 'POST',
        mode: 'no-cors',                      // ← fixes CORS error
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '✅ Fynd OF Platform — Slack webhook test successful!' }),
      });
      setWebhookTestStatus('sent');
      show('Test message sent ✓ — check your Slack channel');
    } catch(e) {
      setWebhookTestStatus('error');
      show('Failed to send — check the webhook URL', 'error');
    }
    setTimeout(() => setWebhookTestStatus(''), 4000);
  };

  // ── Test all 3 team channels via bot token ───────────────────────────────
  const testChannels = async () => {
    if (!BOT_TOKEN) {
      setChannelTestStatus('❌ VITE_SLACK_BOT_TOKEN is not set in GitHub Secrets.');
      return;
    }
    setChannelTesting(true);
    setChannelTestStatus('');
    const results = [];
    for (const [team, ch] of Object.entries(TEAM_CHANNELS)) {
      try {
        const res = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${BOT_TOKEN}`,
          },
          body: JSON.stringify({
            channel: ch.id,
            text: `🧪 *Test from Fynd OF Platform* — ${team} channel (${ch.label}) is reachable ✓`,
          }),
        });
        const data = await res.json();
        results.push(`${team} (${ch.label}): ${data.ok ? '✓ delivered' : '✗ ' + data.error}`);
      } catch(e) {
        results.push(`${team} (${ch.label}): ✗ ${e.message}`);
      }
    }
    setChannelTestStatus(results.join('\n'));
    setChannelTesting(false);
  };

  // ── Google Sheets sync ───────────────────────────────────────────────────
  const handleSync = async () => {
    if (!settings.sheetsId) { alert('Enter a Google Sheet ID first.'); return; }
    setSyncing(true);
    setSyncStatus('');
    try {
      const result = await syncAllToSheets(forms, msg => setSyncStatus(msg));
      show(`✓ Synced ${result.indexRows} OFs and ${result.serviceRows} service rows`);
    } catch(e) {
      setSyncStatus('Error: ' + e.message);
      show('Sync failed: ' + e.message, 'error');
    } finally { setSyncing(false); }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color:NAVY }}>Platform Settings</h2>
      <p className="text-sm text-brand-muted mb-6">Configure integrations and platform behaviour.</p>

      {/* ── Slack ──────────────────────────────────────────────────────────── */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">💬</div>
          <div>
            <h3 className="font-bold" style={{ color:NAVY }}>Slack Notifications</h3>
            <p className="text-sm text-brand-muted mt-0.5">
              Messages are routed to team-specific channels via the Mogambo bot.
            </p>
          </div>
        </div>

        {/* Bot token status */}
        <div className={`mb-4 p-3 rounded-xl text-sm border ${BOT_TOKEN ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          {BOT_TOKEN
            ? '✓ Bot token is configured via GitHub Secrets (VITE_SLACK_BOT_TOKEN).'
            : '⚠️ VITE_SLACK_BOT_TOKEN not found. Add it to GitHub Secrets for full threading support.'}
        </div>

        {/* Channel routing */}
        <div className="mb-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <strong>Channel routing:</strong>
          <div className="mt-1 space-y-0.5">
            <div>🇮🇳 <strong>India team</strong> → <code>#india-channel</code> (C0AQTCE3PNY)</div>
            <div>🌍 <strong>Global team</strong> → <code>#global-channel</code> (C08CBBNRAKZ)</div>
            <div>🤖 <strong>AI/SaaS team</strong> → <code>#aisaas-channel</code> (C0978TZNGM8)</div>
          </div>
        </div>

        {/* Test all channels */}
        <div className="mb-5">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'#94a3b8' }}>
            Test bot → all channels
          </div>
          <Btn onClick={testChannels} disabled={channelTesting} variant="ghost">
            {channelTesting ? '⏳ Sending…' : '🚀 Test all channels'}
          </Btn>
          {channelTestStatus && (
            <div className={`mt-3 p-3 rounded-xl text-xs font-mono whitespace-pre-line border ${channelTestStatus.includes('✗') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
              {channelTestStatus}
            </div>
          )}
        </div>

        {/* Webhook fallback */}
        <div className="pt-4 border-t border-slate-100">
          <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color:'#94a3b8' }}>
            Webhook URL (fallback — used if bot token is absent)
          </div>
          <Inp
            label=""
            value={settings.slackWebhook || ''}
            onChange={v => u('slackWebhook', v)}
            placeholder="https://hooks.slack.com/services/T.../B.../..."
            hint="Only used when VITE_SLACK_BOT_TOKEN is not set"
          />
          <div className="flex items-center gap-3">
            <Btn onClick={testWebhook} variant="ghost" disabled={webhookTestStatus === 'sending'}>
              {webhookTestStatus === 'sending' ? '⏳ Sending…' : '🧪 Test webhook'}
            </Btn>
            {webhookTestStatus === 'sent' && <span className="text-xs font-semibold text-green-600">✓ Sent — check Slack</span>}
            {webhookTestStatus === 'error' && <span className="text-xs font-semibold text-red-600">✗ Failed — check URL</span>}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color:'#94a3b8' }}>
            Notifications fired for
          </div>
          <div className="space-y-1 text-xs text-slate-500">
            <div>📋 <strong>Form submitted</strong> — Sales Rep submits for RevOps review</div>
            <div>✅ <strong>RevOps approved</strong> — sent to Finance queue</div>
            <div>🎉 <strong>Finance approved</strong> — OF# assigned</div>
            <div>❌ <strong>Rejected</strong> — sent back with comment</div>
            <div>⚠️ <strong>Churn / Void request</strong> — filed by RevOps or Finance</div>
            <div>🔔 <strong>Renewal reminder</strong> — contract expiring soon</div>
          </div>
        </div>
      </Card>

      {/* ── Google Sheets ──────────────────────────────────────────────────── */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">📊</div>
          <div>
            <h3 className="font-bold" style={{ color:NAVY }}>Google Sheets Sync</h3>
            <p className="text-sm text-brand-muted mt-0.5">
              Syncs all Order Forms to two tabs — <strong>OF Index</strong> (one row per OF) and <strong>Service Index</strong> (one row per service), matching your original Excel format exactly.
            </p>
          </div>
        </div>

        <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <strong>Setup steps:</strong>
          <ol className="mt-2 space-y-1 list-decimal list-inside text-xs">
            <li>Create a new Google Sheet (or use your existing one)</li>
            <li>Create two tabs named exactly: <code className="bg-blue-100 px-1 rounded">Index</code> and <code className="bg-blue-100 px-1 rounded">Service Index</code></li>
            <li>Copy the Sheet ID from the URL: <code className="bg-blue-100 px-1 rounded">docs.google.com/spreadsheets/d/<strong>THIS_PART</strong>/edit</code></li>
            <li>Paste it below, save settings, then click Sync</li>
            <li>A Google sign-in popup will appear — approve Sheets access</li>
          </ol>
        </div>

        <Inp label="Google Sheet ID"
          value={settings.sheetsId || ''}
          onChange={v => u('sheetsId', v)}
          placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          hint="Found in the Google Sheets URL between /d/ and /edit"/>

        <div className="flex items-center gap-3 mt-2">
          <Btn onClick={handleSync} disabled={syncing || !settings.sheetsId}>
            {syncing ? '⏳ Syncing...' : '🔄 Sync to Google Sheets'}
          </Btn>
          <span className="text-xs text-brand-muted">
            {forms.length} OFs · will sync both Index and Service Index tabs
          </span>
        </div>

        {syncStatus && (
          <div className={`mt-3 p-3 rounded-xl text-sm border ${syncStatus.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            {syncStatus}
          </div>
        )}

        <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <strong>Column mapping (41 columns on Index tab):</strong>
          <p className="mt-1 leading-relaxed">
            SrNo · Order_Form_No · QTR · FY_for_Incentive · Customer_Name · Brand Name · Services · Segment · Sales Team · Sales_Representative · Lead_type · Lead_name · Lead_category · Start_date · End_date · Auto_Renewal · Renewal_Term · Order_Form_Term · Sent for Signing · Date_of_Signing · Submitted · Signed · Dropped · Expired · Unsigned Aging · Submitted_Link · Signed_Link · ARR · Committed Revenue · Committed Revenue Currency · Comments · Churn · TAT · Country · Region · Valyx · Slack ID · Authorised Signatory Name · Authorised Signatory Email · Customer CC · Sales Representative Email
          </p>
        </div>
      </Card>

      <Btn onClick={handleSave}>💾 Save settings</Btn>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
