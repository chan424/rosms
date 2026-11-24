import { useEffect, useState } from 'react';
import { onSnapshot, type DocumentData, type Query } from 'firebase/firestore';

/** Live-subscribes to a Firestore query. Pass null to skip. `key` re-subscribes when it changes. */
export function useCollection<T = DocumentData>(q: Query | null, key: string) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let unsub: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const subscribe = () => {
      unsub = onSnapshot(
        q,
        (snap) => {
          setData(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
          setLoading(false);
          setError(null);
        },
        (e) => {
          // A listener stops after an error. Retry a few times: access can change
          // moments after sign-in (profile/rules propagation).
          if (attempt < 3) {
            attempt += 1;
            timer = setTimeout(subscribe, 1200 * attempt);
            return;
          }
          setError(e.message);
          setLoading(false);
        },
      );
    };
    subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      unsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error };
}
