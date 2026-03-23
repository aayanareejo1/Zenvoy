import React, { createContext, useContext, useState } from 'react';

// syncStatus values: 'idle' | 'syncing' | 'synced' | 'error'
const SyncContext = createContext({
  syncStatus: 'idle',
  syncError: null,
  setSyncStatus: () => {},
  setSyncError: () => {},
});

export const SyncProvider = ({ children }) => {
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError]   = useState(null);

  return (
    <SyncContext.Provider value={{ syncStatus, syncError, setSyncStatus, setSyncError }}>
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => useContext(SyncContext);

export default SyncContext;
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useApp } from './AppContext';
import { SyncManager } from '../services/syncManager';

export const SyncContext = createContext({
  syncStatus:   'idle',
  syncError:    null,
  lastSyncTime: null,
  triggerSync:  () => {},
});

export function SyncProvider({ children }) {
  const { user, isPro, dbReady } = useApp();
  const [syncStatus,   setSyncStatus]   = useState('idle');
  const [syncError,    setSyncError]    = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const managerRef = useRef(null);

  useEffect(() => {
    // Only sync when DB is ready, user is logged in, and has a Pro subscription
    if (!dbReady || !user || !isPro) {
      if (managerRef.current) {
        managerRef.current.destroy();
        managerRef.current = null;
      }
      setSyncStatus('idle');
      return;
    }

    const handleStatusChange = (status) => {
      setSyncStatus(status);
      if (status === 'error') {
        setSyncError(new Date().toISOString());
      } else {
        setSyncError(null);
      }
      if (status === 'synced') {
        setLastSyncTime(new Date().toISOString());
      }
    };

    const manager = new SyncManager(user, handleStatusChange);
    managerRef.current = manager;

    // Initial sync on login / mount
    manager.performSync();
    // Periodic background sync every 5 minutes
    manager.startPeriodicSync();
    // Real-time listener for cloud changes
    manager.startListening();

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, [user, isPro, dbReady]);

  const triggerSync = () => {
    managerRef.current?.performSync();
  };

  return (
    <SyncContext.Provider value={{ syncStatus, syncError, lastSyncTime, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
