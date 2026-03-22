import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from '../services/auth';
import { getSubscriptionStatus } from '../services/firestore';
import { initDb, getInboxCount } from '../services/db';

const AppContext = createContext({});

export const AppProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [isPro, setIsPro]         = useState(false);
  const [dbReady, setDbReady]     = useState(false);
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    initDb().then(() => setDbReady(true));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        const cached = await AsyncStorage.getItem('isPro');
        if (cached === 'true') setIsPro(true);
        const status = await getSubscriptionStatus(u.uid);
        setIsPro(!!status.isPro);
        await AsyncStorage.setItem('isPro', status.isPro ? 'true' : 'false');
      } else {
        setIsPro(false);
      }
    });
    return unsub;
  }, []);

  /** Call this from any screen that changes receipt status to refresh the badge. */
  const refreshInboxCount = useCallback(async () => {
    const count = await getInboxCount();
    setInboxCount(count);
  }, []);

  // Refresh count whenever DB is ready
  useEffect(() => {
    if (dbReady) refreshInboxCount();
  }, [dbReady, refreshInboxCount]);

  return (
    <AppContext.Provider value={{ user, isPro, setIsPro, dbReady, inboxCount, refreshInboxCount }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);
