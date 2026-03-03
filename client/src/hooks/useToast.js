import { useState, useCallback, useRef } from 'react';

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = ++toastIdCounter;

    setToasts((prev) => [...prev, { id, message, type }]);

    timersRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, 3000);

    return id;
  }, [removeToast]);

  return { toasts, addToast, removeToast };
}

export default useToast;
