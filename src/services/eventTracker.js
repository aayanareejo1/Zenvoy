/**
 * Lightweight event tracker.
 * Stores events in AsyncStorage so they survive sessions.
 * Structured to be swappable for Firebase Analytics later:
 *   import { logEvent } from '@react-native-firebase/analytics';
 *   then replace the body of `trackEvent` with logEvent(name, params).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const EVENTS_KEY = '@zenvoy_events';
const MAX_STORED  = 500; // cap to avoid unbounded growth

/** Log a named event with optional params. Fire-and-forget (never throws). */
export const trackEvent = async (name, params = {}) => {
  try {
    const entry = { name, params, ts: new Date().toISOString() };
    const raw   = await AsyncStorage.getItem(EVENTS_KEY);
    const log   = raw ? JSON.parse(raw) : [];
    log.push(entry);
    // Keep only the most recent MAX_STORED events
    if (log.length > MAX_STORED) log.splice(0, log.length - MAX_STORED);
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(log));
  } catch (_) { /* never let tracking break the app */ }
};

/** Return all stored events (for debugging / future upload). */
export const getEvents = async () => {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/** Clear the local event log. */
export const clearEvents = async () => {
  try { await AsyncStorage.removeItem(EVENTS_KEY); } catch (_) {}
};

// ── Named event helpers ────────────────────────────────────────────────────

export const Events = {
  SCAN_STARTED:          'scan_started',
  RECEIPT_QUEUED:        'receipt_queued',
  RECEIPT_SAVED:         'receipt_saved',
  RECEIPT_PROCESSING_DONE: 'receipt_processing_done',
  EXPORT_TRIGGERED:      'export_triggered',
  SYNC_TRIGGERED:        'sync_triggered',
  RESTORE_TRIGGERED:     'restore_triggered',
  ONBOARDING_COMPLETED:  'onboarding_completed',
  SIGN_IN:               'sign_in',
  SIGN_OUT:              'sign_out',
};
