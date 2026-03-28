# Zenvoy — Launch Checklist

## Pre-Launch

### Code & Quality
- [ ] All screens render without crashes on Android and iOS
- [ ] Onboarding flow completes end-to-end (fresh install)
- [ ] Auth: sign up, sign in, Google sign-in, forgot password all work
- [ ] Receipt scan → parse → inbox → mark ready flow works
- [ ] Edit receipt saves correctly and syncs
- [ ] Soft delete removes from list; hard delete via Settings
- [ ] Export PDF and CSV open/share correctly
- [ ] Analytics charts render with data and empty states
- [ ] Search returns correct results; filters work
- [ ] Cloud sync: push and pull work; conflict resolution UI works
- [ ] Offline mode: banner shows; queue processes on reconnect
- [ ] Paywall shows after free limit hit; subscription unlocks Pro
- [ ] Privacy Policy screen accessible from Account
- [ ] No console errors or warnings in production build

### Performance
- [ ] Cold start < 3 seconds on mid-range Android device
- [ ] Receipt list scrolls at 60fps with 100+ items
- [ ] Image capture and parse completes within 10 seconds

### Security
- [ ] `src/constants/config.js` is NOT committed to git (add to .gitignore)
- [ ] `google-services.json` is NOT committed to git
- [ ] Firebase rules restrict reads/writes to authenticated user only
- [ ] API keys are not logged to console in production build
- [ ] No hardcoded passwords or secrets in source

### Assets
- [ ] App icon 1024×1024 PNG (no alpha)
- [ ] Splash screen configured in app.json
- [ ] All 5 iPhone screenshots captured at 6.9"
- [ ] All 5 iPhone screenshots captured at 6.5"
- [ ] iPad screenshots (if submitting universal app)
- [ ] App preview video recorded (optional but recommended)

### Store Setup
- [ ] App Store Connect app record created
- [ ] Bundle ID registered: `[YOUR_BUNDLE_ID]`
- [ ] Google Play Console app record created
- [ ] Package name registered: `[YOUR_PACKAGE_NAME]`
- [ ] Privacy Policy page live at a public URL
- [ ] Support URL live
- [ ] App listing copy written (see `docs/app-store-listing.md`)
- [ ] IAP products configured in App Store Connect and Google Play
- [ ] RevenueCat products linked to store products

### Legal
- [ ] Privacy Policy reviewed by legal or via template service
- [ ] Terms of Service written and live
- [ ] EULA reviewed (App Store standard EULA or custom)
- [ ] GDPR / Canadian PIPEDA compliance reviewed if collecting user data

---

## Submission

### Build
- [ ] Run `expo prebuild --clean` for clean native project
- [ ] Bump version + build number in `app.json`
- [ ] Production build passes: `expo run:android --variant release`
- [ ] Production build passes: `expo run:ios --configuration Release`
- [ ] No debug flags or dev tools in release build
- [ ] ProGuard / Hermes enabled for Android release

### iOS (App Store)
- [ ] Certificates and provisioning profiles up to date in Xcode
- [ ] Archive built successfully in Xcode
- [ ] Upload to App Store Connect via Xcode or Transporter
- [ ] All metadata filled in App Store Connect
- [ ] Age rating questionnaire completed
- [ ] Export compliance answered (uses standard HTTPS encryption)
- [ ] Submit for review

### Android (Google Play)
- [ ] Signed APK/AAB built with release keystore
- [ ] Keystore backed up securely (critical — cannot be recovered)
- [ ] Upload AAB to Google Play Console
- [ ] Store listing complete in Play Console
- [ ] Content rating questionnaire completed
- [ ] Target audience set
- [ ] Roll out to internal track → closed testing → open testing → production

---

## Post-Launch

### Monitoring (Week 1)
- [ ] Monitor crash reports (Firebase Crashlytics or Sentry)
- [ ] Monitor App Store / Play Store reviews daily
- [ ] Verify IAP purchases completing correctly in RevenueCat dashboard
- [ ] Verify Firebase Firestore usage within free tier limits
- [ ] Verify Claude API usage within budget

### Marketing
- [ ] Announce on social media (Twitter/X, LinkedIn, Reddit r/sideprojects)
- [ ] Post to Product Hunt
- [ ] Submit to relevant app directories
- [ ] Reach out to 5–10 potential beta users for early reviews
- [ ] Set up App Store Search Ads campaign (optional)

### Iteration
- [ ] Collect user feedback from reviews and support emails
- [ ] Prioritize top 3 bugs or UX issues for v1.0.1
- [ ] Plan v1.1 feature roadmap based on user requests
- [ ] Set up TestFlight (iOS) and internal test track (Android) for ongoing betas
