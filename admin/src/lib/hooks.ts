'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, errorMessage } from './api';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: (silent?: boolean) => Promise<void>;
}

export function useApi<T>(path: string | null): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const id = ++requestId.current;
      if (!path) {
        setData(null);
        setLoading(false);
        setError(null);
        return;
      }

      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await apiFetch<T>(path);
        if (id === requestId.current) {
          setData(result);
        }
      } catch (cause) {
        if (id === requestId.current) {
          setError(errorMessage(cause));
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
        }
      }
    },
    [path],
  );

  useEffect(() => {
    void load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  return { data, loading, error, reload: load };
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}
