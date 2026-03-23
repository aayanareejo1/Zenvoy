import React, { createContext, useCallback, useContext, useState } from 'react';
import { useToast } from './ToastContext';

const ErrorContext = createContext(null);

export function ErrorProvider({ children }) {
  const { showToast } = useToast();
  const [errors, setErrors] = useState([]);

  const showError = useCallback((message, options = {}) => {
    const { type = 'error', action } = options;
    setErrors(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
    showToast({ message, type, action });
  }, [showToast]);

  const clearErrors = useCallback(() => setErrors([]), []);

  return (
    <ErrorContext.Provider value={{ showError, errors, clearErrors }}>
      {children}
    </ErrorContext.Provider>
  );
}

export const useError = () => {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useError must be used within an <ErrorProvider>');
  return ctx;
};
