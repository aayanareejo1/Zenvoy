# Onboarding Screen — 3-Slide Implementation Plan

## Current State

- `OnboardingScreen.js` already exists with a **6-slide FlatList-based custom slider** (no external library)
- No `react-native-app-intro-slider` installed — adding it requires a native install + rebuild
- The app already has working horizontal pagination, dot indicators, and navigation gating via `ONBOARDING_KEY` in AsyncStorage
- `expo-image-picker` is already installed (has `requestCameraPermissionsAsync`)

---

## Recommendation: Custom UI (no new library)

Installing `react-native-app-intro-slider` requires `npm install` + Android rebuild and gives limited styling control. The existing FlatList slider pattern already covers 90% of what's needed. We'll replace the 6 slides with 3 polished ones using the existing COLORS/TYPE/SPACE tokens — no new dependencies.

---

## Implementation Plan

### Step 1 — Define the 3 Slide Data Objects
Replace the existing `SLIDES` array in `OnboardingScreen.js` with 3 entries:

| Slide | Key Fields |
|-------|-----------|
| **Welcome** | Icon: `✦` or app logo placeholder, Title: "Welcome to Zenvoy", Subtitle: "Receipts, organized instantly" |
| **How It Works** | Icon: 3-step visual (camera → sparkle → chart), Title: "Snap. Extract. Done.", Body: short 3-bullet walkthrough |
| **Camera Permission** | Icon: camera illustration, Title: "Allow Camera Access", Body: "Zenvoy uses your camera to scan receipts. We never store photos in the cloud.", CTA: "Allow Camera" button |

---

### Step 2 — Redesign the Slide Layout Component
Each slide gets a full-screen layout with three zones:

```
┌─────────────────────┐
│                     │
│   Illustration /    │  ← ~50% height, centered graphic or icon cluster
│   Icon Area         │
│                     │
├─────────────────────┤
│  Title (TYPE.h1)    │  ← text block, left-aligned or centered
│  Subtitle/Body      │
│  (TYPE.body)        │
├─────────────────────┤
│  [Slide-specific    │  ← reserved slot for slide 3's "Allow Camera" button
│   CTA or empty]     │
└─────────────────────┘
```

Style rules:
- Background: `COLORS.bg` (#0A0A0F) with a subtle teal radial glow (`COLORS.accentGlow`) behind the illustration
- Illustration area: a `View` with a large emoji/icon or a simple SVG-like shape built from `View`s
- Text: white on dark, `COLORS.accent` for highlights

---

### Step 3 — Implement the Camera Permission Flow (Slide 3 Only)

Slide 3 renders an extra **"Allow Camera"** `TouchableOpacity` button above the standard Next/Get Started button:

1. On press → call `ImagePicker.requestCameraPermissionsAsync()` (already available from `expo-image-picker`)
2. If granted → visually confirm (button turns green with a checkmark, changes label to "Permission Granted")
3. If denied → show a `ToastContext` message: "You can enable this later in Settings"
4. The "Get Started" button is always enabled — permission is requested, not required to proceed

---

### Step 4 — Update Navigation & Controls

Keep the existing structure:
- **Dot indicators** — 3 dots instead of 6, same animated width logic
- **Skip button** — visible on slides 1 & 2 only (slide 3 is the last, so Skip becomes redundant)
- **Next / Get Started** — "Next" on slides 1–2, "Get Started" on slide 3
- On "Get Started": write `'true'` to `ONBOARDING_KEY`, fire `trackEvent(Events.ONBOARDING_COMPLETED)`, then `navigation.replace('Main')`

No changes to `App.js` are needed.

---

### Step 5 — Polish Pass

- Add `expo-haptics` feedback (`Haptics.impactAsync`) on button taps (already installed)
- Ensure safe-area insets are respected top and bottom (`useSafeAreaInsets`)
- Test on both light and dark themes (use `useTheme()` context already in the app)
- Verify no back-navigation is possible from the onboarding stack (already handled by `replace`)

---

## Files Touched

| File | Change |
|------|--------|
| `src/screens/OnboardingScreen.js` | Full rewrite of slide data + layout component |
| `App.js` | No changes |
| `src/services/eventTracker.js` | No changes (reuse existing `ONBOARDING_COMPLETED` event) |
