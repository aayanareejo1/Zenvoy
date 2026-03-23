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
