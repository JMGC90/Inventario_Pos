import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';

const ToastContext = createContext(null);
let contador = 0;

const ICONO_POR_TIPO = {
  success: 'checkCircle',
  error: 'alert',
  warning: 'alert',
  info: 'fileText',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, { type = 'success', title = '', duration } = {}) => {
      const id = `toast-${Date.now()}-${(contador += 1)}`;
      const toast = { id, message, title, type };
      setToasts((prev) => [...prev.slice(-3), toast]);
      const tiempo = duration ?? (type === 'error' ? 7200 : 4800);
      const timer = setTimeout(() => dismiss(id), tiempo);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const api = useMemo(
    () => ({
      show: push,
      success: (message, title) => push(message, { type: 'success', title }),
      error: (message, title) => push(message, { type: 'error', title }),
      warning: (message, title) => push(message, { type: 'warning', title }),
      info: (message, title) => push(message, { type: 'info', title }),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role="status">
            <span className="toast-icon">
              <Icon name={ICONO_POR_TIPO[toast.type] ?? 'fileText'} size={19} />
            </span>
            <div className="toast-body">
              {toast.title ? <strong>{toast.title}</strong> : null}
              <span>{toast.message}</span>
            </div>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Cerrar aviso">
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de ToastProvider');
  return context;
}
