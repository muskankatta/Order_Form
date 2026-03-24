import { useState, useCallback } from 'react';

export function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);
  const hide = useCallback(() => setToast(null), []);
  return { toast, show, hide };
}
