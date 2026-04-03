<h1 align="center">Zenvoy</h1>

<p align="center">
  <strong>AI-powered receipt scanning and expense tracking for iOS and Android</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.83-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Expo-55-000020?style=flat-square&logo=expo" />
  <img src="https://img.shields.io/badge/Claude_AI-Anthropic-D97757?style=flat-square" />
  <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black" />
</p>

Zenvoy turns a photo of any receipt into a structured expense record in seconds. No manual entry. Just point, shoot, and your spending is tracked automatically.

## Features

- **Instant scanning** — Capture with your camera or pick from your photo library. Claude AI extracts the merchant, date, total, line items, and spending category automatically.
- **Smart inbox** — Every scan lands in a review queue. Confirm, edit, or discard before receipts are filed.
- **Spending analytics** — Charts for category breakdown, monthly trends, top vendors, and tax-deductible totals. Set a monthly budget and track against it.
- **PDF and CSV export** — Share reports directly with an accountant or import into a spreadsheet.
- **Cloud sync** — Sign in with email or Google to back up and sync receipts across devices via Firebase/Firestore. Offline-first with automatic conflict resolution.
- **Works offline** — All data lives in a local SQLite database. The app is fully functional without a connection.
- **Free and Pro tiers** — 5 free scans per month. Zenvoy Pro removes the limit via in-app purchase.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.83 + Expo 55 |
| Navigation | React Navigation (tabs + native stacks) |
| Local storage | SQLite via `expo-sqlite` |
| AI parsing | Claude API (Anthropic) |
| Cloud sync | Firebase Auth + Firestore |
| Subscriptions | RevenueCat |
| Camera / images | `expo-image-picker`, `expo-image-manipulator` |

## Getting started

### Prerequisites

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Android Studio (for Android) or Xcode 16+ (for iOS)

### 1. Clone and install

```bash
git clone https://github.com/aayanareejo1/Zenvoy.git
cd Zenvoy
npm install
```

### 2. Configure API keys

```bash
cp src/constants/config.example.js src/constants/config.js
```

Open `src/constants/config.js` and fill in:

| Key | Where to get it |
|---|---|
| `CLAUDE_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `GOOGLE_WEB_CLIENT_ID` | Firebase console > Authentication > Sign-in providers > Google |

### 3. Add Firebase config files

Create a Firebase project with **Authentication** and **Firestore** enabled, then download:

- `google-services.json` into `android/app/`
- `GoogleService-Info.plist` into the project root

### 4. Run

```bash
npm start          # Expo dev server (scan QR with Expo Go)
npm run android    # Build and run on Android
npm run ios        # Build and run on iOS
```

## Project structure

```
App.js                    # Entry point, providers and navigation
src/
  screens/                # One file per screen
  components/             # Shared UI components
  context/                # React contexts (App, Toast, Sync, Theme, Error)
  services/               # Business logic (AI, database, sync, export)
  constants/              # Theme, colors, config template
  utils/                  # Utility helpers
android/                  # Android native project
plugins/                  # Expo config plugins (Firebase, in-app purchases)
.github/workflows/        # CI (iOS Podfile validation)
```

## Security

- `src/constants/config.js` is gitignored. Never commit API keys.
- `google-services.json` and `GoogleService-Info.plist` are gitignored. Add your own from the Firebase console.
- Firebase Security Rules should restrict all reads and writes to the authenticated user.

## License

MIT
