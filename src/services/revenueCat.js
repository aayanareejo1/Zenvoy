/**
 * revenueCat.js — RevenueCat SDK wrapper
 *
 * Centralises all RC interactions so no screen imports
 * react-native-purchases directly.
 */
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import {
  REVENUECAT_ANDROID_API_KEY,
  REVENUECAT_IOS_API_KEY,
  RC_ENTITLEMENT_ID,
} from '../constants/config';

// ─── Init ──────────────────────────────────────────────────────────────────────

/**
 * Call once at app startup, before any other RC method.
 * Does NOT identify the user — call identifyUser() after Firebase auth.
 */
export function configureRevenueCat() {
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.ERROR);

  const apiKey = Platform.OS === 'ios'
    ? REVENUECAT_IOS_API_KEY
    : REVENUECAT_ANDROID_API_KEY;

  Purchases.configure({ apiKey });
}

// ─── Identity ──────────────────────────────────────────────────────────────────

/**
 * Log in a known user (use Firebase UID as appUserID).
 * RC merges any anonymous purchases into the identified account.
 * Returns the latest CustomerInfo.
 */
export async function identifyUser(userId) {
  const { customerInfo } = await Purchases.logIn(userId);
  return customerInfo;
}

/**
 * Reset to anonymous user on sign-out.
 * No-ops if RC is already tracking an anonymous user (avoids the
 * "Called logOut but the current user is anonymous" warning).
 */
export async function resetToAnonymous() {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    if (!customerInfo.originalAppUserId.startsWith('$RCAnonymousID:')) {
      return await Purchases.logOut();
    }
  } catch (_) {
    // RC not ready or already anonymous — nothing to do
  }
}

// ─── Customer Info ─────────────────────────────────────────────────────────────

/** Fetch the latest CustomerInfo from RC (may hit cache). */
export async function getCustomerInfo() {
  return Purchases.getCustomerInfo();
}

/**
 * Register a listener that fires whenever CustomerInfo changes
 * (e.g. purchase completed, subscription renewed).
 * Returns the remove function — call it in a useEffect cleanup.
 */
export function addCustomerInfoListener(callback) {
  Purchases.addCustomerInfoUpdateListener(callback);
  return () => Purchases.removeCustomerInfoUpdateListener(callback);
}

// ─── Entitlement ───────────────────────────────────────────────────────────────

/**
 * Returns true if the customerInfo object contains an active "Zenvoy Pro"
 * entitlement. Safe to call with null/undefined.
 */
export function isProEntitled(customerInfo) {
  return typeof customerInfo?.entitlements?.active?.[RC_ENTITLEMENT_ID] !== 'undefined';
}

// ─── Restore ───────────────────────────────────────────────────────────────────

/** Restore purchases and return updated CustomerInfo. */
export async function restorePurchases() {
  return Purchases.restorePurchases();
}
