const KEY = 'fynd_of_forms';

// Strip base64 blobs before writing to localStorage.
// SoW is now a Google Drive link — old records may still carry .data fields
// from before the migration. Stripping here prevents quota errors permanently.
const stripBlobs = (forms) => forms.map(f => ({
  ...f,
  sow_document: f.sow_document?.data
    ? { name: f.sow_document.name, size: f.sow_document.size, type: f.sow_document.type }
    : f.sow_document,
  sow_reference_document: f.sow_reference_document?.data
    ? { name: f.sow_reference_document.name, size: f.sow_reference_document.size, type: f.sow_reference_document.type }
    : f.sow_reference_document,
}));

export const storage = {
  get() {
    try {
      const d = localStorage.getItem(KEY);
      return d ? JSON.parse(d) : [];
    } catch {
      return [];
    }
  },

  set(forms) {
    const clean = JSON.stringify(stripBlobs(Array.isArray(forms) ? forms : []));
    try {
      localStorage.setItem(KEY, clean);
    } catch (e) {
      // Quota exceeded — clear the stale bloated entry and retry.
      // This self-heals on the very first write after deployment.
      console.warn('[storage] Quota exceeded — clearing and retrying…');
      try {
        localStorage.removeItem(KEY);
        localStorage.setItem(KEY, clean);
        console.info('[storage] Recovery successful.');
      } catch (e2) {
        console.error('[storage] Still full after clear — other keys may be consuming quota.', e2);
      }
    }
  },

  clear() {
    localStorage.removeItem(KEY);
  },
};
