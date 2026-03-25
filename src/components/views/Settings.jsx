import { useState } from 'react';
import { Card, Btn, Inp, Toast } from '../ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../hooks/useToast.js';

const NAVY = '#1B2B4B'; const T = '#00C3B5';
const LS_KEY = 'fynd_of_settings';

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
export function saveSettings(s) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

export default function Settings() {
  const { user } = useAuth();
  const { toast, show, hide } = useToast();
  const [settings, setSettings] = useState(loadSettings);

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

  const handleSave = () => {
    saveSettings(settings);
    show('Settings saved ✓');
  };

  const testSlack = async () => {
    if (!settings.slackWebhook) { alert('Enter a webhook URL first.'); return; }
    try {
      await fetch(settings.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '✅ Fynd OF Platform — Slack webhook test successful!' }),
      });
      show('Test message sent to Slack ✓');
    } catch(e) {
      show('Failed to send — check the webhook URL', 'error');
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color:NAVY }}>Platform Settings</h2>
      <p className="text-sm text-brand-muted mb-6">Configure integrations and platform behaviour.</p>

      {/* Slack */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">💬</div>
          <div>
            <h3 className="font-bold" style={{ color:NAVY }}>Slack Notifications</h3>
            <p className="text-sm text-brand-muted mt-0.5">Notifications are sent when OFs are submitted, approved, rejected, or signed.</p>
          </div>
        </div>

        <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <strong>How to get a Slack Webhook URL:</strong>
          <ol className="mt-2 space-y-1 list-decimal list-inside text-xs">
            <li>Go to <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer" className="underline font-medium">api.slack.com/apps</a></li>
            <li>Click <strong>Create New App → From scratch</strong></li>
            <li>Name it <strong>Fynd OF Platform</strong>, select your Fynd workspace</li>
            <li>Click <strong>Incoming Webhooks</strong> → toggle On</li>
            <li>Click <strong>Add New Webhook to Workspace</strong> → pick a channel (e.g. #of-notifications)</li>
            <li>Copy the webhook URL — it starts with <code className="bg-blue-100 px-1 rounded">https://hooks.slack.com/services/...</code></li>
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-4">
          <Inp label="Slack Incoming Webhook URL"
            value={settings.slackWebhook||''}
            onChange={v=>u('slackWebhook',v)}
            placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
            hint="Paste the full webhook URL from your Slack app settings"/>
          <Inp label="Slack channel name (optional, for reference)"
            value={settings.slackChannel||''}
            onChange={v=>u('slackChannel',v)}
            placeholder="#of-notifications"/>
        </div>

        <div className="flex gap-3">
          <Btn onClick={testSlack} variant="ghost">🧪 Test webhook</Btn>
        </div>
      </Card>

      {/* Google Sheets */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">📊</div>
          <div>
            <h3 className="font-bold" style={{ color:NAVY }}>Google Sheets Sync</h3>
            <p className="text-sm text-brand-muted mt-0.5">Automatically sync all Order Form data to a Google Sheet.</p>
          </div>
        </div>

        <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
          <strong>How to set up Google Sheets sync:</strong>
          <ol className="mt-2 space-y-1 list-decimal list-inside text-xs">
            <li>Create a new Google Sheet</li>
            <li>Copy the Sheet ID from the URL: <code className="bg-green-100 px-1 rounded">docs.google.com/spreadsheets/d/<strong>THIS_PART</strong>/edit</code></li>
            <li>Paste it below</li>
            <li>Note: Sync requires you to be logged in with a Google account that has edit access to the sheet</li>
          </ol>
        </div>

        <Inp label="Google Sheet ID"
          value={settings.sheetsId||''}
          onChange={v=>u('sheetsId',v)}
          placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
          hint="Found in the Google Sheets URL between /d/ and /edit"/>
      </Card>

      {/* Multi-user warning */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">⚠️</div>
          <div>
            <h3 className="font-bold" style={{ color:NAVY }}>Data Sharing Limitation</h3>
            <p className="text-sm text-brand-muted mt-0.5">Important: understand how data is stored.</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm space-y-2">
          <p>This platform currently uses <strong>browser localStorage</strong> to store data. This means:</p>
          <ul className="list-disc list-inside text-xs space-y-1">
            <li>Data created on one person's browser <strong>is not visible</strong> to others on different browsers/devices</li>
            <li>When a Sales Rep submits a form on their laptop, RevOps on a different machine won't see it</li>
            <li><strong>Workaround:</strong> Everyone must use the same browser profile, OR data must be manually exported/imported</li>
          </ul>
          <p className="text-xs font-semibold mt-2">To export all data from this browser and share it:</p>
          <ol className="list-decimal list-inside text-xs space-y-1">
            <li>Open browser console (Cmd+Option+J)</li>
            <li>Run: <code className="bg-amber-100 px-1 rounded">copy(localStorage.getItem('fynd_of_forms'))</code></li>
            <li>Paste into a .json file and share with the recipient</li>
            <li>They open the platform, open console, and run: <code className="bg-amber-100 px-1 rounded">localStorage.setItem('fynd_of_forms', PASTE_HERE)</code></li>
          </ol>
          <p className="text-xs mt-2">Phase 2 will add a real backend (Firebase/Supabase) to fix this permanently.</p>
        </div>
      </Card>

      <Btn onClick={handleSave}>💾 Save settings</Btn>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
