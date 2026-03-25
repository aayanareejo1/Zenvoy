import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useApp } from './AppContext';
import { SyncManager } from '../services/syncManager';
import networkService from '../services/networkService';

export const SyncContext = createContext({
  syncStatus:   'idle',
  syncError:    null,
  lastSyncTime: null,
  isOnline:     true,
  triggerSync:  () => {},
});

export function SyncProvider({ children }) {
  const { user, isPro, dbReady } = useApp();
  const [syncStatus,   setSyncStatus]   = useState('idle');
  const [syncError,    setSyncError]    = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isOnline,     setIsOnline]     = useState(networkService.isConnected);
  const managerRef = useRef(null);

  // Track network state — auto-sync on reconnect
  useEffect(() => {
    const handler = (connected, reconnected) => {
      setIsOnline(connected);
      if (reconnected && managerRef.current) {
        managerRef.current.performSync();
      }
    };
    networkService.addListener(handler);
    return () => networkService.removeListener(handler);
  }, []);

  // Set up SyncManager when user / pro / db changes
  useEffect(() => {
    if (!dbReady || !user || !isPro) {
      managerRef.current?.destroy();
      managerRef.current = null;
      setSyncStatus('idle');
      return;
    }

    const handleStatusChange = (status) => {
      setSyncStatus(status);
      setSyncError(status === 'error' ? new Date().toISOString() : null);
      if (status === 'synced') setLastSyncTime(new Date().toISOString());
    };

    const manager = new SyncManager(user, handleStatusChange);
    managerRef.current = manager;

    manager.performSync();
    manager.startPeriodicSync();
    manager.startListening();

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, [user, isPro, dbReady]);

  // Sync on foreground resume (only when online)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && managerRef.current && networkService.isConnected) {
        managerRef.current.performSync();
      }
    });
    return () => sub.remove();
  }, []);

  const triggerSync = () => {
    if (networkService.isConnected) managerRef.current?.performSync();
  };

  return (
    <SyncContext.Provider value={{ syncStatus, syncError, lastSyncTime, isOnline, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export const useSync = () => useContext(SyncContext);
