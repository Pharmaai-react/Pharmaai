import { useState, useCallback, useEffect, useRef } from 'react';

export function useNotification() {
  const [notifications, setNotifications] = useState([]);
  const timers = useRef({});

  const showNotification = useCallback((message) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, hiding: false }]);

    timers.current[id] = setTimeout(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, hiding: true } : n));
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        delete timers.current[id];
      }, 300);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  return { notifications, showNotification };
}
