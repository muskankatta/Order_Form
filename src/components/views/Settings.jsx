import { useState } from 'react';
import { Card, Btn, Inp, Toast } from '../ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { syncAllToSheets } from '../../utils/sheets.js';

const NAVY = '#1B2B4B'; const T = '#00C3B5';
const LS_KEY = 'fynd_of_settings';

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

  const testSlack = async () => {
    if (!settings.slackWebhook) { alert('Enter a webhook URL first.'); return; }
    try {
      await fetch(settings.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '✅ Fynd OF Platform — Slack webhook test successful!' }),
      });
      show('Test message sent to Slack ✓');
    } catch { show('Failed to send — check the webhook URL', 'error'); }
  };

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

      {/* Google Sheets */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">📊</div>
          <div>
            <h3 className="font-bold" style={{ color:NAVY }}>Google Sheets Sync</h3>
            <p className="text-sm text-brand-muted mt-0.5">
              Syncs all Order Forms to two tabs — <strong>Index</strong> (one row per OF) and <strong>Service Index</strong> (one row per service), matching your original Excel format exactly.
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
          value={settings.sheetsId||''}
          onChange={v=>u('sheetsId',v)}
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
          <div className={`mt-3 p-3 rounded-xl text-sm ${syncStatus.startsWith('Error') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
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

      {/* Slack */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">💬</div>
          <div>
            <h3 className="font-bold" style={{ color:NAVY }}>Slack Notifications</h3>
            <p className="text-sm text-brand-muted mt-0.5">Sent when OFs are submitted, approved, rejected, or signed.</p>
          </div>
        </div>
        <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <strong>How to get a Slack Webhook URL:</strong>
          <ol className="mt-2 space-y-1 list-decimal list-inside text-xs">
            <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="underline font-medium">api.slack.com/apps</a></li>
            <li>Create New App → From scratch → name it <strong>Fynd OF Platform</strong></li>
            <li>Incoming Webhooks → toggle On → Add New Webhook → pick a channel</li>
            <li>Copy the webhook URL starting with <code className="bg-blue-100 px-1 rounded">https://hooks.slack.com/services/...</code></li>
          </ol>
        </div>
        <Inp label="Slack Incoming Webhook URL"
          value={settings.slackWebhook||''}
          onChange={v=>u('slackWebhook',v)}
          placeholder="https://hooks.slack.com/services/T.../B.../..."
          hint="Paste the full webhook URL from your Slack app settings"/>
        <Inp label="Slack channel name (for reference)"
          value={settings.slackChannel||''}
          onChange={v=>u('slackChannel',v)}
          placeholder="#of-notifications"/>
        <Btn onClick={testSlack} variant="ghost">🧪 Test webhook</Btn>
      </Card>

      <Btn onClick={handleSave}>💾 Save settings</Btn>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
