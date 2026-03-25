# Zenvoy – CLAUDE.md

## Project Overview
Zenvoy is a React Native (Expo) receipt scanning and management app. Users scan receipts with their camera, which are processed via Claude AI, stored locally in SQLite, and optionally synced to Firebase/Firestore.

## Tech Stack
- **Framework**: React Native 0.83 + Expo ~55
- **Navigation**: React Navigation (bottom tabs + native stacks)
- **Local DB**: expo-sqlite
- **Cloud**: Firebase Auth + Firestore (`@react-native-firebase`)
- **AI**: Claude API (via `src/services/claude.js`)
- **Storage**: AsyncStorage, expo-file-system
- **Other**: expo-image-picker, expo-image-manipulator, expo-print, expo-sharing, NetInfo

## Project Structure
```
App.js                    # Root: providers + navigation
src/
  screens/                # One file per screen
  components/             # Shared UI components
  context/                # React contexts (App, Toast, Sync, Theme, Error)
  services/               # Business logic (db, auth, claude, sync, export, etc.)
  constants/              # Theme/colors
  utils/                  # Utility helpers
android/                  # Android native project
```

## Key Screens
| Screen | Purpose |
|--------|---------|
| ScanScreen | Camera capture entry point |
| ProcessingScreen | AI receipt processing |
| ReceiptsScreen | List of saved receipts |
| ReceiptDetailScreen | View single receipt |
| EditReceiptScreen | Edit receipt fields |
| InboxScreen | Unreviewed receipts queue |
| ExportScreen | PDF/CSV export |
| SearchScreen | Full-text search |
| AnalyticsScreen | Spending analytics |
| SyncManagementScreen | Cloud sync conflict resolution |
| AccountScreen | Auth + settings |
| OnboardingScreen | First-run flow |

## Key Services
- `claude.js` – Claude API calls for receipt parsing
- `db.js` – SQLite schema + queries (single source of truth for all DB functions)
- `syncManager.js` – Orchestrates local↔cloud sync (main sync entry point)
- `syncService.js` – Push/pull sync logic + Firestore real-time listener
- `firestore.js` – Raw Firestore read/write operations
- `networkService.js` – Network state monitoring
- `queueService.js` – Offline batch processing queue
- `exportService.js` – PDF/CSV generation
- `searchService.js` – Full-text search
- `analyticsService.js` – Spending analytics
- `backgroundProcessor.js` – Background fetch tasks

## db.js Function Reference
### Receipts
| Function | Purpose |
|----------|---------|
| `insertReceipt(receipt)` | Insert new local receipt (synced=0) |
| `updateReceipt(id, receipt)` | Edit receipt, bumps version, marks unsynced |
| `updateReceiptFromScan(id, fields)` | Lightweight update from queue worker |
| `insertReceiptFromCloud(receipt)` | Insert receipt from Firestore (synced=1) |
| `updateReceiptFromCloud(id, fields, firestoreId, version)` | Update local with cloud data (synced=1) |
| `deleteReceipt(id)` | Hard delete |
| `softDeleteReceipt(id)` | Mark deleted, flags for cloud sync |
| `markReceiptSynced(id, firestoreId, version?)` | Mark as synced, optionally set version |
| `getReceiptById(id)` | Single receipt |
| `getAllReceipts()` | All receipts |
| `getReadyReceipts()` | Status='ready' only |
| `getInboxReceipts()` | Status='needs_review' |
| `getUnsyncedReceipts()` | synced=0 rows |

### Queue (`receipt_queue` table)
| Function | Purpose |
|----------|---------|
| `insertQueueItem(receiptId, photoUri)` | Add to queue |
| `insertQueueEntry(receiptId, photoUri)` | Alias for above |
| `getQueueItems(status)` | By status |
| `getQueueEntries(status)` | Alias for above |
| `getAllQueueEntries()` | All rows, any status |
| `getQueueEntryById(id)` | Single row |
| `updateQueueItemStatus(id, status, attempts)` | Update status+attempts |
| `updateQueueEntry(id, updates)` | Update by object |
| `incrementQueueRetryCount(id)` | Bump attempts counter |
| `deleteQueueItem(id)` | Remove from queue |

### Failed Syncs (`failed_syncs` table)
| Function | Purpose |
|----------|---------|
| `insertFailedSync(receiptId, error, operation)` | Log a sync failure |
| `getFailedSyncs()` | All failed syncs |
| `deleteFailedSync(id)` | Remove after retry succeeds |
| `incrementFailedSyncAttempt(id)` | Bump attempt_count +1 |
| `updateFailedSyncAttempt(id, count)` | Set attempt_count to specific value |

## Dev Commands
```bash
npm start          # Start Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
```

## Open Draft PRs (as of 2026-03-25)
- #10 Error Recovery & Network Handling
- #9 Analytics event tracking
- #8 Performance optimization
- #7 Network service with error handling

## Known Issues / Next Steps
- **ReportsScreen** — needs implementation review
- **Background fetch** — needs testing on Android (`backgroundProcessor.js`)
- **Photo restore** — cloud pull sync sets `photo_uri: null`; Firebase Storage not yet used
- **No test suite** — Jest + RNTL not configured
- **CI** — no GitHub Actions workflow yet

## Notes
- No test suite currently configured
- `COLORS` theme is defined in `src/constants/theme.js`
- Onboarding completion stored in AsyncStorage under `ONBOARDING_KEY`
- Provider order in App.js: ThemeProvider → AppProvider → ToastProvider → ErrorProvider → SyncProvider
- `syncService.js` is the push/pull logic layer; `syncManager.js` is the orchestrator — do not call syncService directly from UI
- `firestore.js` exports `fetchFirestoreReceipts` (not `getCloudReceipts`) — use the exact name
