import { useState, useEffect, useRef } from 'react';

function readStoredValue(key, initialValue) {
  try {
    const item = window.localStorage.getItem(key);
    if (item === null) return initialValue;

    try {
      return JSON.parse(item);
    } catch {
      return item;
    }
  } catch (error) {
    console.warn(`Error reading localStorage key "${key}":`, error);
    return initialValue;
  }
}

export default function useLocalStorage(key, initialValue) {
  const initialValueRef = useRef(initialValue);
  const [storedValue, setStoredValue] = useState(() => readStoredValue(key, initialValue));

  const setValue = (value) => {
    try {
      setStoredValue(currentValue => {
        const valueToStore = value instanceof Function ? value(currentValue) : value;

        if (valueToStore === null || valueToStore === undefined) {
          window.localStorage.removeItem(key);
        } else {
          const stringified = typeof valueToStore === 'string' ? valueToStore : JSON.stringify(valueToStore);
          window.localStorage.setItem(key, stringified);
        }

        window.dispatchEvent(new CustomEvent('local-storage-sync', {
          detail: { key, newValue: valueToStore }
        }));

        return valueToStore;
      });
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  useEffect(() => {
    initialValueRef.current = initialValue;
    setStoredValue(readStoredValue(key, initialValueRef.current));

    const handleStorageChange = (event) => {
      if (event.key !== key) return;
      setStoredValue(event.newValue === null ? initialValueRef.current : readStoredValue(key, initialValueRef.current));
    };

    const handleLocalSync = (event) => {
      if (!event.detail || event.detail.key !== key) return;
      setStoredValue(event.detail.newValue === null || event.detail.newValue === undefined ? initialValueRef.current : event.detail.newValue);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-sync', handleLocalSync);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-sync', handleLocalSync);
    };
  }, [key]);

  return [storedValue, setValue];
}
