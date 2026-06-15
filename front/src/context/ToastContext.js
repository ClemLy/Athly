import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View } from 'react-native';
import AppToast from '../components/ui/AppToast';

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext(null);

// ─── ToastProvider ────────────────────────────────────────────────────────────

export function ToastProvider({ children }) {
  const [toast, setToast]   = useState(null);
  const toastKeyRef         = useRef(0); // force remontage si même message répété

  // showToast(message, type, duration?)
  // type : 'success' | 'error' | 'warning' | 'info'
  const showToast = useCallback((message, type = 'info', duration = 3500) => {
    toastKeyRef.current += 1;
    setToast({ message, type, duration, key: toastKeyRef.current });
  }, []);

  const hideToast = useCallback(() => setToast(null), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {/* Le View flex: 1 assure que le toast positionné en absolute reste dans la fenêtre. */}
      <View style={{ flex: 1 }}>
        {children}
        {toast && (
          <AppToast
            key={toast.key}
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onHide={hideToast}
          />
        )}
      </View>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
