# Zenvoy – Architecture & Dependency Map

## Provider Stack (App.js)
```
ThemeProvider
  AppProvider          ← initDb, onAuthStateChanged, getSubscriptionStatus
    ToastProvider
      ErrorProvider    ← useToast (depends on ToastContext)
        SyncProvider   ← useApp (depends on AppContext), SyncManager, networkService
```

## Context Dependencies
| Context | Imports from |
|---------|-------------|
| `AppContext` | `auth`, `firestore` (getSubscriptionStatus), `db` (initDb, getInboxCount) |
| `SyncContext` | `AppContext`, `syncManager`, `networkService` |
| `ErrorContext` | `ToastContext` |
| `ToastContext` | — |
| `ThemeContext` | — |

## Service Dependency Graph
```
SyncContext
  └─ syncManager        ← firestore (syncReceiptToFirestore, restoreFromFirestore)
       └─ db            ← expo-sqlite
          └─ (all DB ops)

syncService             ← db, firestore (fetchFirestoreReceipts, updateReceiptInFirestore,
  (push/pull logic)          softDeleteReceiptInFirestore, getCloudReceipt)

backgroundProcessor     ← imageProcessor, claude, db (updateReceiptFromScan), queueService
queueService            ← db (insertQueueEntry, getQueueEntries, updateQueueEntry,
                              incrementQueueRetryCount, getQueueEntryById)
networkService          ← NetInfo (no internal deps)
exportService           ← db, expo-print, expo-sharing
searchService           ← db
analyticsService        ← db (or AsyncStorage)
auth                    ← @react-native-firebase/auth
firestore               ← @react-native-firebase/firestore, db (insertReceipt, getAllReceipts)
```

## SQLite Schema

### `receipts`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | auto |
| vendor | TEXT | |
| date | TEXT | ISO string |
| total | REAL | default 0 |
| tax | REAL | default 0 |
| category | TEXT | default 'Other' |
| status | TEXT | 'ready' \| 'needs_review' \| 'deleted' |
| notes | TEXT | JSON array (serialized) |
| photo_uri | TEXT | local file path |
| created_at | TEXT | ISO string |
| updated_at | TEXT | ISO string |
| synced | INTEGER | 0 = dirty, 1 = synced |
| version | INTEGER | incremented on every local edit |
| device_id | TEXT | set on push sync |
| firestore_id | TEXT | Firestore doc ID |
| tags | TEXT | JSON array |
| ocr_confidence | INTEGER | nullable |

### `receipt_queue`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | auto |
| receipt_id | INTEGER | FK → receipts.id |
| photo_uri | TEXT | |
| status | TEXT | 'pending' \| 'processing' \| 'completed' \| 'failed' |
| attempts | INTEGER | default 0 |
| created_at | TEXT | |

### `failed_syncs`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | auto |
| receipt_id | INTEGER | FK → receipts.id |
| operation | TEXT | 'push' \| 'delete' |
| error | TEXT | |
| attempt_count | INTEGER | default 1 |
| failed_at | TEXT | ISO string |

## Firestore Document Shape (`users/{uid}/receipts/{firestoreId}`)
```js
{
  vendor, date, total, tax, category, status, notes,  // receipt fields
  photoUri,       // camelCase (not photo_uri)
  createdAt,      // camelCase (not created_at)
  updatedAt,      // camelCase (not updated_at)
  version,
  deviceId,       // camelCase (not device_id)
  isDeleted,      // boolean — used for soft deletes
}
```
> Note: local SQLite uses snake_case; Firestore uses camelCase. Mapping happens in firestore.js.

## Naming Conventions & Gotchas

### firestore.js exports (exact names — do not guess)
| Export | Purpose |
|--------|---------|
| `syncReceiptToFirestore(uid, receipt)` | Initial push |
| `updateReceiptInFirestore(uid, receipt)` | Update existing doc |
| `softDeleteReceiptInFirestore(uid, receiptId, firestoreId?)` | Mark isDeleted=true |
| `fetchFirestoreReceipts(uid)` | Fetch all non-deleted (NOT `getCloudReceipts`) |
| `getCloudReceipt(uid, firestoreId)` | Single doc fetch |
| `restoreFromFirestore(uid)` | Full restore, deduplicates locally |
| `getSubscriptionStatus(uid)` | Pro status |
| `setProStatus(uid, isPro, expiresAt)` | Set pro status |

### db.js queue functions — two naming styles both work
- `insertQueueItem` = `insertQueueEntry`
- `getQueueItems(status)` = `getQueueEntries(status)`
- `updateQueueItemStatus(id, status, attempts)` → raw
- `updateQueueEntry(id, updatesObj)` → object-based wrapper

### Sync flow
1. **Push**: `SyncManager.syncUp()` → reads `getUnsyncedReceipts()` → calls `syncReceiptToFirestore` → `markReceiptSynced(id, firestoreId, version)`
2. **Pull**: `syncService.syncCloudChangesToLocal()` → `fetchFirestoreReceipts()` → `insertReceiptFromCloud` or `updateReceiptFromCloud`
3. **Restore**: `restoreFromFirestore(uid)` → deduplicates by vendor+date+total fingerprint
4. **Real-time**: `listenToCloudReceipts(user, onUpdate)` in syncService — returns unsubscribe fn

## Screen → Context/Service Dependencies
| Screen | Key dependencies |
|--------|-----------------|
| ScanScreen | AppContext, queueService, db |
| ProcessingScreen | backgroundProcessor, db (getAllQueueEntries, getQueueEntryById) |
| ReceiptsScreen | AppContext, db |
| ReceiptDetailScreen | db, softDeleteReceipt |
| EditReceiptScreen | db (updateReceipt) |
| InboxScreen | AppContext, db |
| ExportScreen | exportService |
| SearchScreen | searchService |
| AnalyticsScreen | analyticsService |
| SyncManagementScreen | SyncContext, db (getFailedSyncs) |
| AccountScreen | AppContext, auth, firestore |
| OnboardingScreen | AsyncStorage (ONBOARDING_KEY) |
