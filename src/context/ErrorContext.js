import React, { createContext, useCallback, useContext, useState } from 'react';
import { useToast } from './ToastContext';

/**
 * ErrorContext — global error state management.
 *
 * Provides:
 *   showError(message, options?)  — display a toast and log to error history
 *   errors                        — array of logged error entries
 *   clearErrors()                 — reset the log
 *
 * options: { type?: 'error'|'warning'|'info', action?: { label, onPress } }
 */

const ErrorContext = createContext(null);

export function ErrorProvider({ children }) {
  const { showToast } = useToast();
  const [errors, setErrors] = useState([]);

  /**
   * Show a user-visible error toast and append the entry to the history log.
   */
  const showError = useCallback((message, options = {}) => {
    const { type = 'error', action } = options;

    // Log to in-memory history
    setErrors(prev => [
      ...prev,
      { message, type, timestamp: new Date().toISOString() },
    ]);

    // Surface via toast notification
    showToast({ message, type, action });
  }, [showToast]);

  /** Clear the in-memory error history. */
  const clearErrors = useCallback(() => setErrors([]), []);

  return (
    <ErrorContext.Provider value={{ showError, errors, clearErrors }}>
      {children}
    </ErrorContext.Provider>
  );
}

/** Hook to access the error context. Must be used inside <ErrorProvider>. */
export const useError = () => {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useError must be used within an <ErrorProvider>');
  return ctx;
};
