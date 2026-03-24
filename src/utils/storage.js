const KEY = 'fynd_of_forms';

export const storage = {
  get()       { try { const d = localStorage.getItem(KEY); return d ? JSON.parse(d) : []; } catch { return []; } },
  set(forms)  { try { localStorage.setItem(KEY, JSON.stringify(forms)); } catch(e) { console.error('Storage full', e); } },
  clear()     { localStorage.removeItem(KEY); },
};
