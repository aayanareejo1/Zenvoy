import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { onAuthStateChanged } from '../services/auth';
import { initDb, getInboxCount } from '../services/db';
import { getRetryableItems } from '../services/queueService';
import { processQueueItem } from '../services/backgroundProcessor';
import {
  identifyUser,
  resetToAnonymous,
  isProEntitled,
  addCustomerInfoListener,
} from '../services/revenueCat';

const AppContext = createContext({});

export const AppProvider = ({ children }) => {
  const [user,       setUser]       = useState(null);
  const [isPro,      setIsPro]      = useState(false);
  const [isGuest,    setIsGuest]    = useState(false);
  const [dbReady,    setDbReady]    = useState(false);
  const [inboxCount, setInboxCount] = useState(0);

  // ── DB init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    initDb().then(() => setDbReady(true));
  }, []);

  // ── Auth + RevenueCat identity ───────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(async (u) => {
      setUser(u);
      setIsGuest(!!u?.isAnonymous);
      if (u) {
        try {
          // Identify this Firebase user in RC; get fresh entitlements.
          const customerInfo = await identifyUser(u.uid);
          setIsPro(isProEntitled(customerInfo));
        } catch (e) {
          // Network offline or RC unavailable — default to free.
          console.warn('[RC] identifyUser failed:', e.message);
          setIsPro(false);
        }
      } else {
        // User signed out — reset RC to anonymous.
        try { await resetToAnonymous(); } catch (_) {}
        setIsPro(false);
      }
    });
    return unsub;
  }, []);

  // ── Real-time entitlement updates ────────────────────────────────────────────
  // Fires whenever a purchase completes, a subscription renews, or RC syncs.
  useEffect(() => {
    const remove = addCustomerInfoListener((customerInfo) => {
      setIsPro(isProEntitled(customerInfo));
    });
    return remove;
  }, []);

  // ── Foreground queue flush (fallback for disabled background tasks) ──────────
  // When the app returns to the foreground, process any pending queue items.
  // This is the primary delivery mechanism while expo-task-manager is blocked
  // by the Kotlin 2.2 upstream conflict (see backgroundProcessor.js).
  useEffect(() => {
    if (!dbReady) return;

    const flushQueue = async () => {
      try {
        const items = await getRetryableItems();
        for (const item of items) {
          processQueueItem(item).catch(() => {});
        }
      } catch (_) {}
    };

    // Flush on mount and on every foreground transition.
    flushQueue();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushQueue();
    });
    return () => sub.remove();
  }, [dbReady]);

  // ── Inbox count ──────────────────────────────────────────────────────────────
  const refreshInboxCount = useCallback(async () => {
    const count = await getInboxCount();
    setInboxCount(count);
  }, []);

  useEffect(() => {
    if (dbReady) refreshInboxCount();
  }, [dbReady, refreshInboxCount]);

  return (
    <AppContext.Provider value={{ user, isPro, setIsPro, isGuest, dbReady, inboxCount, refreshInboxCount }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
