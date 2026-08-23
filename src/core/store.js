import { useState, useEffect } from 'react';
import { api } from './api';

// ---------------------------------------------------------------------------
// INTERNAL STATE
// ---------------------------------------------------------------------------

/** Raw data store: key -> value (null means not yet fetched) */
const _data = {};

/** Timestamp of last successful fetch: key -> Date.now() */
const _fetchedAt = {};

/** In-flight fetch promises to avoid duplicate parallel requests */
const _inflight = {};

/** Subscriber callbacks: key -> Set<(value) => void> */
const _subs = {};

// Client-side TTL mirrors server-side cache TTL
const TTL = {
  assistants: 13_000,  // slightly under server 15s to avoid stale window
  clients:    4_000,   // slightly under server 5s
  ticketsMeta: 4_000,
};

// ---------------------------------------------------------------------------
// CORE PRIMITIVES
// ---------------------------------------------------------------------------

function _notify(key) {
  const fns = _subs[key];
  if (fns) fns.forEach(fn => fn(_data[key]));
}

function _set(key, value) {
  _data[key] = value;
  _fetchedAt[key] = Date.now();
  _notify(key);
}

function _subscribe(key, fn) {
  if (!_subs[key]) _subs[key] = new Set();
  _subs[key].add(fn);
  return () => _subs[key].delete(fn);
}

function _isStale(key) {
  const ttl = TTL[key];
  if (!ttl) return true;
  const at = _fetchedAt[key];
  if (!at) return true;
  return Date.now() - at > ttl;
}

// ---------------------------------------------------------------------------
// FETCH FUNCTIONS (deduplicated, TTL-aware)
// ---------------------------------------------------------------------------

async function _fetch(key, fetcher, force = false) {
  // If not stale and not forced, return cached value immediately
  if (!force && !_isStale(key) && _data[key] !== undefined) {
    return _data[key];
  }
  // If already fetching, wait for the in-flight promise
  if (_inflight[key]) return _inflight[key];

  _inflight[key] = fetcher()
    .then(data => {
      _set(key, data);
      return data;
    })
    .catch(err => {
      console.error(`[store] Error fetching "${key}":`, err);
      // Keep stale data on error rather than setting null
      throw err;
    })
    .finally(() => {
      delete _inflight[key];
    });

  return _inflight[key];
}

// ---------------------------------------------------------------------------
// PUBLIC FETCH API
// ---------------------------------------------------------------------------

export const store = {
  /** Fetch assistants from Railway. Pass force=true to bypass client TTL. */
  fetchAssistants: (force = false) =>
    _fetch('assistants', () => api.getAssistants(force), force),

  /** Fetch clients from Supabase. */
  fetchClients: (force = false) =>
    _fetch('clients', () => api.getClients(force), force),

  /** Fetch tickets meta from Supabase. */
  fetchTicketsMeta: (force = false) =>
    _fetch('ticketsMeta', () => api.getTicketsMeta(force), force),

  /**
   * Invalidate one or more store keys, triggering a background re-fetch.
   * Does NOT set data to null — existing data remains visible while refreshing.
   */
  invalidate: (...keys) => {
    keys.forEach(key => {
      delete _fetchedAt[key]; // mark as stale
    });
    // Kick off background re-fetches (fire-and-forget)
    if (keys.includes('assistants')) store.fetchAssistants(true).catch(() => {});
    if (keys.includes('clients'))    store.fetchClients(true).catch(() => {});
    if (keys.includes('ticketsMeta')) store.fetchTicketsMeta(true).catch(() => {});
  },

  /** Apply an optimistic local update without waiting for the next fetch. */
  updateLocal: (key, updater) => {
    if (typeof updater !== 'function' || _data[key] === undefined) return _data[key] ?? null;
    _set(key, updater(_data[key]));
    return _data[key] ?? null;
  },

  /** Get current value synchronously (null if not yet loaded). */
  get: (key) => _data[key] ?? null,
};

// ---------------------------------------------------------------------------
// REACT HOOK
// ---------------------------------------------------------------------------

/**
 * Subscribe to a store key. Returns the current value.
 * - Returns `null` only on the very first load (before any fetch).
 * - On background refreshes, returns the previous value instantly, then the
 *   new value once the fetch resolves — no loading flash.
 *
 * @param {string} key - Store key ('assistants' | 'clients' | 'ticketsMeta')
 * @param {Function} [fetchFn] - Optional fetch function to call on mount if data is stale
 */
export function useStoreKey(key, fetchFn) {
  const [value, setValue] = useState(() => _data[key] ?? null);

  useEffect(() => {
    // Sync with current store value in case it changed between render and effect
    setValue(_data[key] ?? null);

    // Subscribe to future changes
    const unsub = _subscribe(key, setValue);

    // If data is stale (or not yet loaded), trigger a background fetch
    if (fetchFn && (_data[key] === undefined || _isStale(key))) {
      fetchFn().catch(() => {});
    }

    return unsub;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return value;
}
