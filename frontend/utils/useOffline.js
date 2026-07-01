/**
 * useOffline.js - React hook for offline/online state
 *
 * Returns:
 *   isOnline      {boolean} - true if navigator.onLine
 *   pendingCount  {number}  - number of queued offline mutations
 *   isSyncing     {boolean} - true while flush is running
 *   syncNow       {fn}      - manually trigger a sync flush
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getPendingCount, flushQueue } from './offlineQueue';

export function useOffline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const wasOfflineRef = useRef(false);

  // Refresh pending count from IndexedDB
  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB not available (SSR)
    }
  }, []);

  // Flush queue to server
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    setIsSyncing(true);
    try {
      await flushQueue((done, total) => {
        // Optionally update progress
        setPendingCount(Math.max(0, total - done));
      });
      await refreshCount();
    } catch (err) {
      console.error('[useOffline] syncNow error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, isOnline, refreshCount]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial count
    refreshCount();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync if we were offline before
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        // Small delay to let the connection stabilise
        setTimeout(async () => {
          setIsSyncing(true);
          try {
            await flushQueue();
            await refreshCount();
          } finally {
            setIsSyncing(false);
          }
        }, 1200);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
      refreshCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll pending count every 30s (picks up changes from other tabs)
    const interval = setInterval(refreshCount, 30_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshCount]);

  return { isOnline, pendingCount, isSyncing, syncNow, refreshCount };
}
