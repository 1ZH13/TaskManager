'use client';

import { useEffect, useRef, useState } from 'react';

/** A mutation is committed once; refreshing the view must never invite a duplicate retry. */
export function useBoardAction(refresh: () => Promise<boolean>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const locked = useRef(false);
  const generation = useRef(0);
  const latestRefresh = useRef(refresh);
  useEffect(() => {
    latestRefresh.current = refresh;
  }, [refresh]);
  useEffect(() => {
    const current = ++generation.current;
    return () => {
      if (generation.current === current) generation.current += 1;
    };
  }, []);

  const run = async (operation: () => Promise<unknown>, message: string): Promise<boolean> => {
    if (locked.current) return false;
    locked.current = true;
    const current = generation.current;
    setPending(true);
    setError('');
    setStatus('');
    setRefreshFailed(false);
    let committed = false;
    try {
      await operation();
      committed = true;
      if (generation.current !== current) return false;
      const refreshed = await latestRefresh.current();
      if (generation.current !== current) return false;
      setStatus(message);
      if (!refreshed) {
        setRefreshFailed(true);
        setError('El cambio se guardó, pero no pudimos actualizar el tablero. Usa Reintentar.');
      }
      return true;
    } catch (failure) {
      if (generation.current !== current) return false;
      setRefreshFailed(committed);
      setError(
        committed
          ? 'El cambio se guardó, pero no pudimos actualizar el tablero. Usa Reintentar.'
          : failure instanceof Error
            ? failure.message
            : 'No se pudo guardar el cambio. Inténtalo de nuevo.',
      );
      return committed;
    } finally {
      if (generation.current === current) {
        locked.current = false;
        setPending(false);
      }
    }
  };
  return {
    run,
    pending,
    error,
    status,
    setError,
    refreshFailed,
    retryRefresh: () => run(() => Promise.resolve(), 'Tablero actualizado.'),
  };
}
