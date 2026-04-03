# Zenvoy

A mobile app for scanning, organizing, and tracking receipts using AI. Point your camera at any receipt and Zenvoy automatically extracts the vendor, date, amount, and category — no manual entry required.

## What it does

**Scan** — Capture receipts with your camera or pick from your photo library. The image is processed by Claude AI, which extracts the merchant name, date, total, line items, and spending category.

**Organize** — Receipts land in an inbox for quick review. Mark them ready, edit any field, or delete them. All data is stored locally in SQLite so the app works fully offline.

**Track** — Analytics screen shows spending by category, monthly trends, top vendors, and tax-deductible totals. Set a monthly budget and track progress against it.

**Export** — Generate PDF or CSV reports to share with an accountant or import into a spreadsheet.

**Sync** — Optional cloud sync via Firebase/Firestore. Sign in with email or Google to back up receipts and access them across devices. Conflict resolution is built in.

**Pro** — Free tier includes 5 scans/month. Zenvoy Pro (via in-app purchase) removes the limit.

## Tech stack

- React Native 0.83 + Expo 55
- SQLite (local storage via `expo-sqlite`)
- Claude API (receipt parsing)
- Firebase Auth + Firestore (cloud sync)
- RevenueCat (subscriptions)
- React Navigation (bottom tabs + native stacks)

## Getting started

### Prerequisites

- Node.js 20+
- Expo CLI (`npm install -g expo`)
- Android Studio or Xcode for native builds

### Setup

```bash
git clone https://github.com/aayanareejo1/Zenvoy.git
cd Zenvoy
npm install
```

Copy the config template and fill in your API keys:

```bash
cp src/constants/config.example.js src/constants/config.js
```

You'll need:
- A [Claude API key](https://console.anthropic.com) for receipt parsing
- A Firebase project with Auth and Firestore enabled — download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) into the project root
- A [RevenueCat](https://www.revenuecat.com) account if you want to test in-app purchases (optional)

### Run

```bash
npm start          # Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
```

## Project structure

```
App.js                  # Root — providers + navigation
src/
  screens/              # One file per screen
  components/           # Shared UI components
  context/              # React contexts (App, Toast, Sync, Theme, Error)
  services/             # Business logic (db, claude, sync, export, analytics…)
  constants/            # Theme, colors, config
  utils/                # Helpers
android/                # Android native project
plugins/                # Expo config plugins (Firebase, IAP)
```

## Screens

| Screen | Purpose |
|--------|---------|
| Scan | Camera capture + AI parsing |
| Inbox | Unreviewed receipts queue |
| Receipts | Full receipt list |
| Receipt Detail | View a single receipt |
| Edit Receipt | Edit any field |
| Analytics | Spending charts and budget tracking |
| Search | Full-text search with filters |
| Export | PDF / CSV generation |
| Sync Management | Cloud sync conflict resolution |
| Account | Auth, settings, privacy policy |
| Onboarding | First-run setup |

## Notes

- `src/constants/config.js` is gitignored — never commit real API keys
- `google-services.json` and `GoogleService-Info.plist` are gitignored — add your own from the Firebase console
- Firebase Security Rules should restrict reads/writes to the authenticated user only
