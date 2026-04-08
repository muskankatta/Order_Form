import { useState } from 'react';
import { Card, Btn, Inp, Toast } from '../ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useForms } from '../../context/FormsContext.jsx';
import { useToast } from '../../hooks/useToast.js';
import { syncAllToSheets } from '../../utils/sheets.js';
import { requestSheetsToken, importFromSheets } from '../../utils/sheetsImport.js';
import { db, isConfigured } from '../../firebase.js';
import { doc, setDoc } from 'firebase/firestore';

const NAVY = '#1B2B4B'; const T = '#00C3B5';
const LS_KEY = 'fynd_of_settings';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
export function saveSettings(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

export default function Settings() {
  const { user }  = useAuth();
  const { forms } = useForms();
  const { toast, show, hide } = useToast();
  const [settings, setSettings] = useState(loadSettings);

  // Outbound sync state
  const [syncStatus, setSyncStatus] = useState('');
  const [syncing,    setSyncing]    = useState(false);

  // Import state
  const [importing,     setImporting]     = useState(false);
  const [importStatus,  setImportStatus]  = useState('');
  const [importPreview, setImportPreview] = useState(null); // { imported, updated, skipped, toWrite }
  const [committing,    setCommitting]    = useState(false);

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

  // ── Outbound sync to Sheets ──────────────────────────────────────────────
  const handleSync = async () => {
    if (!settings.sheetsId) { alert('Enter a Google Sheet ID first.'); return; }
    setSyncing(true); setSyncStatus('');
    try {
      const result = await syncAllToSheets(forms, msg => setSyncStatus(msg));
      show(`✓ Synced ${result.indexRows} OFs and ${result.serviceRows} service rows`);
    } catch(e) {
      setSyncStatus('Error: ' + e.message);
      show('Sync failed: ' + e.message, 'error');
    } finally { setSyncing(false); }
  };

  // ── Import from Sheets — Step 1: parse & preview ─────────────────────────
  const handleImportPreview = async () => {
    setImporting(true);
    setImportStatus('');
    setImportPreview(null);
    try {
      setImportStatus('Requesting Google Sheets access…');
      const token   = await requestSheetsToken(CLIENT_ID);
      const results = await importFromSheets(token, forms, msg => setImportStatus(msg));
      setImportPreview(results);
      setImportStatus(
        `Preview ready: ${results.imported} new OFs · ${results.updated} updates · ${results.skipped} unchanged`
      );
    } catch(e) {
      setImportStatus('Error: ' + e.message);
    } finally { setImporting(false); }
  };

  // ── Import — Step 2: commit to Firestore ─────────────────────────────────
  const handleCommit = async () => {
    if (!importPreview?.toWrite?.length) return;
    setCommitting(true);
    setImportStatus('Writing to Firestore…');
    try {
      let done = 0;
      for (const form of importPreview.toWrite) {
        if (isConfigured && db) {
          // Strip large binary fields before writing
          const { sow_document, sow_reference_document, ...rest } = form;
          await setDoc(doc(db, 'order_forms', form.id), {
            ...rest,
            sow_document_name: null,
            sow_reference_document_name: null,
          });
        }
        done++;
        if (done % 10 === 0) setImportStatus(`Writing… ${done}/${importPreview.toWrite.length}`);
      }
      show(`✓ Import complete — ${importPreview.imported} new, ${importPreview.updated} updated`);
      setImportStatus(`✓ Done — ${importPreview.imported} new OFs imported, ${importPreview.updated} updated.`);
      setImportPreview(null);
    } catch(e) {
      setImportStatus('Error during write: ' + e.message);
      show('Import failed: ' + e.message, 'error');
    } finally { setCommitting(false); }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2" style={{ color:NAVY }}>Platform Settings</h2>
      <p className="text-sm text-brand-muted mb-6">Configure integrations and platform behaviour.</p>

      {/* ── Import from Google Sheets ───────────────────────────────────────── */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">⬇️</div>
          <div>
            <h3 className="font-bold" style={{ color:NAVY }}>Import from Google Sheets</h3>
            <p className="text-sm text-brand-muted mt-0.5">
              One-time bulk import from your existing OF repository in Google Sheets into the platform.
            </p>
          </div>
        </div>

        <div className="mb-4 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs">
          <strong>Source sheet:</strong>
          <div className="mt-1 font-mono break-all">
            https://docs.google.com/spreadsheets/d/16YjUNyERrUU3oeHlGXdrZ9F3i5zB3RXOILFMfFDs6lQ/edit
          </div>
          <div className="mt-2 space-y-0.5">
            <div>📋 Tab: <strong>Index</strong></div>
            <div>🔗 Signed OF URL: Column AP</div>
            <div>⚙️ Ignored: Columns AE, AJ (Valyx), AL–AN</div>
          </div>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          <strong>Conflict rule:</strong> If an OF# already exists in the platform, fields that differ will be overwritten. If everything matches, the row is skipped.
        </div>

        {/* Step 1 — Preview */}
        {!importPreview && (
          <Btn onClick={handleImportPreview} disabled={importing}>
            {importing ? '⏳ Fetching…' : '🔍 Preview import'}
          </Btn>
        )}

        {importStatus && (
          <div className={`mt-3 p-3 rounded-xl text-sm border ${
            importStatus.startsWith('Error')
              ? 'bg-red-50 border-red-200 text-red-700'
              : importStatus.startsWith('✓')
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            {importStatus}
          </div>
        )}

        {/* Step 2 — Preview results + confirm */}
        {importPreview && (
          <div className="mt-4">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { lbl:'New OFs',    val:importPreview.imported, color:'#15803d' },
                { lbl:'Updates',    val:importPreview.updated,  color:'#1d4ed8' },
                { lbl:'Unchanged',  val:importPreview.skipped,  color:'#94a3b8' },
              ].map(s => (
                <div key={s.lbl} className="p-3 rounded-xl border text-center" style={{ borderColor:'#e2e8f0' }}>
                  <div className="text-2xl font-black" style={{ color:s.color }}>{s.val}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-brand-faint mt-0.5">{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Sample preview */}
            {importPreview.toWrite.length > 0 && (
              <div className="mb-4 rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-brand-faint">
                  Preview (first 5 rows to be written)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth:'600px' }}>
                    <thead>
                      <tr className="border-b border-slate-100">
                        {['OF Number','Customer','Status','Signed Date','Committed Revenue'].map(h => (
                          <th key={h} className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-faint">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.toWrite.slice(0,5).map(f => (
                        <tr key={f.id} className="border-b border-slate-50">
                          <td className="px-3 py-2 font-mono font-bold" style={{ color:NAVY }}>{f.of_number||'—'}</td>
                          <td className="px-3 py-2" style={{ color:NAVY }}>{f.customer_name}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{ background: f.status==='signed'?'#f0fdf4':f.status==='approved'?'#eff6ff':'#f1f5f9',
                                       color:      f.status==='signed'?'#15803d':f.status==='approved'?'#1d4ed8':'#475569' }}>
                              {f.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-brand-muted">{f.signed_date||'—'}</td>
                          <td className="px-3 py-2 font-mono text-brand-muted">
                            {f.committed_currency||'INR'} {Number(f.committed_revenue||0).toLocaleString('en-IN')||'—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Btn onClick={handleCommit} disabled={committing || importPreview.toWrite.length === 0}>
                {committing ? '⏳ Importing…' : `✓ Confirm & import ${importPreview.toWrite.length} rows`}
              </Btn>
              <Btn variant="ghost" onClick={() => { setImportPreview(null); setImportStatus(''); }}>
                Cancel
              </Btn>
            </div>
          </div>
        )}
      </Card>

      {/* ── Outbound Google Sheets sync ─────────────────────────────────────── */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="text-2xl">📊</div>
          <div>
            <h3 className="font-bold" style={{ color:NAVY }}>Google Sheets Sync (Outbound)</h3>
            <p className="text-sm text-brand-muted mt-0.5">
              Push all platform OFs to your Google Sheet — OF Index and Service Index tabs.
            </p>
          </div>
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
          <span className="text-xs text-brand-muted">{forms.length} OFs in platform</span>
        </div>

        {syncStatus && (
          <div className={`mt-3 p-3 rounded-xl text-sm border ${syncStatus.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
            {syncStatus}
          </div>
        )}
      </Card>

      <Btn onClick={handleSave}>💾 Save settings</Btn>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide}/>}
    </div>
  );
}
