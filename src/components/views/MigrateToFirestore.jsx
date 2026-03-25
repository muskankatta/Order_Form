import { useState } from 'react';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, isConfigured } from '../../firebase.js';
import { storage } from '../../utils/storage.js';
import { Card, Btn } from '../ui/index.jsx';

const NAVY = '#1B2B4B';

export default function MigrateToFirestore({ onDone }) {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [count,  setCount]  = useState(0);
  const [msg,    setMsg]    = useState('');

  const run = async () => {
    setStatus('running');
    setMsg('Reading localStorage…');
    const forms = storage.get();
    if (!forms.length) { setMsg('No data in localStorage to migrate.'); setStatus('done'); return; }
    if (!isConfigured || !db) { setMsg('Firebase not configured. Add VITE_FIREBASE_* secrets first.'); setStatus('error'); return; }

    try {
      setMsg(`Migrating ${forms.length} Order Forms to Firestore…`);
      // Write in batches of 500 (Firestore limit)
      const BATCH_SIZE = 400;
      let written = 0;
      for (let i = 0; i < forms.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = forms.slice(i, i + BATCH_SIZE);
        chunk.forEach(f => {
          if (!f.id) return;
          batch.set(doc(collection(db, 'order_forms'), f.id), {
            ...f, _updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
        written += chunk.length;
        setCount(written);
        setMsg(`Migrated ${written} / ${forms.length}…`);
      }
      setMsg(`✓ All ${written} Order Forms migrated to Firestore! Real-time sync is now active.`);
      setStatus('done');
      setTimeout(() => onDone?.(), 2000);
    } catch(e) {
      console.error(e);
      setMsg(`Error: ${e.message}`);
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background:'rgba(0,0,0,0.5)' }}>
      <Card className="p-8 max-w-lg w-full mx-4">
        <div className="text-3xl mb-3">🔄</div>
        <h2 className="text-xl font-bold mb-2" style={{ color:NAVY }}>Migrate data to Firestore</h2>
        <p className="text-sm text-brand-muted mb-6">
          This will copy all {storage.get().length} Order Forms from this browser's localStorage into Firebase Firestore.
          After migration, all users on all devices will see the same data in real time.
          This only needs to be done once.
        </p>

        {status === 'idle' && (
          <div className="flex gap-3">
            <Btn onClick={run}>Start migration →</Btn>
            <Btn variant="ghost" onClick={onDone}>Skip for now</Btn>
          </div>
        )}

        {status === 'running' && (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor:'#00C3B5' }}/>
              <span className="text-sm text-brand-muted">{msg}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width:`${(count/storage.get().length)*100}%`, background:'#00C3B5' }}/>
            </div>
          </div>
        )}

        {(status === 'done' || status === 'error') && (
          <div>
            <p className={`text-sm font-medium mb-4 ${status==='error'?'text-red-600':'text-green-700'}`}>{msg}</p>
            <Btn variant="ghost" onClick={onDone}>Close</Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
