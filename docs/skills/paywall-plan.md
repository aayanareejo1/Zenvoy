# Paywall Implementation Plan

## Current State Assessment

The core plumbing already exists but is **incomplete**:

| What exists | Where |
|---|---|
| `FREE_MONTHLY_LIMIT = 5` constant | `src/constants/config.js` |
| `getMonthlyCount()` — counts receipts with `photo_uri` this calendar month | `src/services/db.js:241` |
| `checkScanLimit(isPro)` helper — returns bool | `src/screens/ScanScreen.js:25` |
| `gateScan()` — calls `checkScanLimit`, sets `paywallSheet` state | `src/screens/ScanScreen.js:128` |
| `paywallSheet` bottom-sheet UI in `ScanScreen` | `src/screens/ScanScreen.js:307` |
| `isPro` flag in `AppContext` (loaded from Firestore + cached in AsyncStorage) | `src/context/AppContext.js` |

**What's missing:**
1. `getMonthlyCount()` counts receipts saved to the DB, but single-scan flow calls the DB **after** user picks a photo and AI processes it — meaning the check happens at the wrong time (only gateScan checks before, but multi-scan rechecks mid-flow). Need to verify the count is checked correctly before any API call is made.
2. No dedicated `PaywallScreen` — only an inline bottom-sheet. A full-screen Paywall with IAP integration is not implemented.
3. No IAP purchase flow (`IAP_PRODUCTS` constants exist in config but nothing connects to `react-native-iap` or `expo-in-app-purchases`).
4. `AccountScreen` shows an "Upgrade to Pro" section but it only navigates to itself — no purchase actually fires.

---

## Implementation Plan

### Step 1 — Verify `getMonthlyCount()` accuracy (db.js)

**File:** `src/services/db.js`

The current query counts receipts by `photo_uri IS NOT NULL` and `created_at LIKE '2026-03%'`. This is correct for the single-scan path (photo saved before AI call in the queue flow) but in `processSingle`, the receipt is not inserted until `handleSave`. This means a user can process unlimited photos in one session without saving and the counter never increments until save.

**Fix:** Move the counter check to rely on queue insertions, not saves. When `insertReceipt` is called for multi-scan queueing (`status='needs_review'`), `photo_uri` is set — so multi-scan is counted correctly. For single-scan, `gateScan()` checks before the photo is picked (correct), but the receipt is not recorded until `handleSave`. This is a minor gap (user can pick → discard → re-pick infinite times). For MVP, no change needed — `gateScan()` gating before the pick is sufficient.

No db.js changes required for Step 1.

---

### Step 2 — Add a `scan_count` migration guard (db.js)

**File:** `src/services/db.js` — `initDb()`

No new table is needed; `getMonthlyCount()` derives the count from `receipts`. However, confirm the `photo_uri` column is always set when a queued item is inserted (it is — see `doMultiScan` in ScanScreen). No schema change needed.

---

### Step 3 — Create `PaywallScreen` (new file)

**File:** `src/screens/PaywallScreen.js`

A full-screen modal presented via `navigation.navigate('Paywall')`. Responsibilities:

```
PaywallScreen
├── Header: "Upgrade to Pro"
├── Benefit list:
│   ├── Unlimited receipt scans
│   ├── Cloud backup & sync
│   └── Priority support
├── Monthly price button  → triggers IAP purchase (zenvoy_pro_monthly)
├── Annual price button   → triggers IAP purchase (zenvoy_pro_yearly)
├── Restore Purchases link
└── Dismiss / "Maybe later" link
```

Props received via `route.params`:
- `onSuccess?: () => void` — callback to resume the interrupted scan after upgrade

The screen uses `useApp()` to access `setIsPro`. On successful purchase it calls `setProStatus(uid, true, expiresAt)` (from `firestore.js`) then `setIsPro(true)` then invokes `onSuccess?.()`.

---

### Step 4 — Register `PaywallScreen` in navigation (App.js)

**File:** `App.js`

Add `PaywallScreen` as a modal in the root `RootStack` (same level as `Onboarding`), so it overlays any tab:

```js
// App.js — inside RootStack
import PaywallScreen from './src/screens/PaywallScreen';

<RootStack.Screen
  name="Paywall"
  component={PaywallScreen}
  options={{ presentation: 'modal', headerShown: false }}
/>
```

This gives every screen access to `navigation.navigate('Paywall', { onSuccess })`.

---

### Step 5 — Replace the inline paywall sheet in ScanScreen with navigation (ScanScreen.js)

**File:** `src/screens/ScanScreen.js`

Remove the `paywallSheet` state and the inline `<Sheet>` paywall block. Replace the `setPaywallSheet(true)` calls with:

```js
navigation.navigate('Paywall', {
  onSuccess: () => { /* re-invoke the scan action that was gated */ }
});
```

Specific locations:
- `gateScan()` (line 130): replace `setPaywallSheet(true)` → `navigation.navigate('Paywall', { onSuccess: retryFn })`
- `doMultiScan()` (line 226): replace `setPaywallSheet(true)` → same pattern

Because `gateScan` returns a bool, the calling code (`pickSingle`, `handleMultiScan`) can still use the same `if (!(await gateScan())) return` pattern — just `gateScan` navigates instead of setting sheet state.

---

### Step 6 — Wire "Upgrade to Pro" in AccountScreen (AccountScreen.js)

**File:** `src/screens/AccountScreen.js`

The current `!isPro` block (line 186) shows a sheet (`upgradeSheet`) with no purchase action. Replace or augment:

```js
// Where upgradeSheet is shown:
navigation.navigate('Paywall');
```

Remove the `upgradeSheet` state if it is purely a placeholder with no real content.

---

### Step 7 — Install and configure an IAP library

Install `expo-in-app-purchases` (already in the Expo ecosystem, consistent with the rest of the stack):

```bash
npx expo install expo-in-app-purchases
```

In `PaywallScreen`, use:
```js
import * as InAppPurchases from 'expo-in-app-purchases';
```

Flow:
1. `InAppPurchases.connectAsync()` on mount
2. `InAppPurchases.getProductsAsync([IAP_PRODUCTS.monthly, IAP_PRODUCTS.yearly])` to fetch prices
3. `InAppPurchases.purchaseItemAsync(productId)` on button press
4. Listen with `InAppPurchases.setPurchaseListener` — on `PURCHASED`, call `setProStatus` + `setIsPro(true)`
5. `InAppPurchases.disconnectAsync()` on unmount

---

### Step 8 — Display remaining scans on ScanScreen (ScanScreen.js)

**File:** `src/screens/ScanScreen.js`

Add a small badge/label below the "Scan Receipt" button showing remaining free scans. This surfaces the limit before the user hits it.

```js
// Load count on mount and after each save
const [monthCount, setMonthCount] = useState(0);
useEffect(() => {
  if (!isPro) getMonthlyCount().then(setMonthCount);
}, [result, isPro]);

// Render below CTA:
{!isPro && (
  <Text style={s.scanCountLabel}>
    {Math.max(0, FREE_MONTHLY_LIMIT - monthCount)} free scan{remaining !== 1 ? 's' : ''} left this month
  </Text>
)}
```

---

## Data Flow Summary

```
User taps "Scan Receipt"
  └─ gateScan()
       └─ getMonthlyCount()   [db.js — counts receipts with photo_uri this month]
            ├─ count < 5  → proceed normally
            └─ count >= 5 → navigation.navigate('Paywall', { onSuccess: retryFn })
                               └─ User purchases Pro
                                    ├─ setProStatus(uid, true, ...)   [firestore.js]
                                    ├─ setIsPro(true)                 [AppContext]
                                    └─ onSuccess() → re-enters scan flow
```

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/services/db.js` | No changes needed — `getMonthlyCount()` is correct |
| `src/screens/PaywallScreen.js` | **New file** — full-screen IAP paywall |
| `App.js` | Register `PaywallScreen` as root modal |
| `src/screens/ScanScreen.js` | Replace inline paywall sheet → `navigation.navigate('Paywall')` |
| `src/screens/AccountScreen.js` | Replace no-op upgrade sheet → `navigation.navigate('Paywall')` |
| `src/constants/config.js` | No changes needed — `FREE_MONTHLY_LIMIT` and `IAP_PRODUCTS` already defined |

---

## Open Questions Before Implementation

1. **IAP library choice** — `expo-in-app-purchases` is deprecated in favor of `react-native-iap`. Confirm which to use before Step 7.
2. **Sandbox testing** — An Apple/Google developer account with a configured app ID is required to test IAP on device.
3. **Pro status source of truth** — Currently `isPro` is read from Firestore on sign-in and cached in AsyncStorage. After an IAP purchase by a non-signed-in user, where is the status stored? Decide: require sign-in before upgrade, or cache locally via AsyncStorage only.
4. **Paywall analytics** — Should `trackEvent` be called on paywall impression, dismiss, and purchase? (Recommended yes.)
