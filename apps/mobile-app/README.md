# SocietyOS Mobile (Android APK)

Wraps the resident PWA in a native Android shell via Capacitor.

## How you get your .apk (no Android SDK needed on your machine)

1. Push this branch to GitHub.
2. Open **Actions → Android APK** → latest run → **Artifacts** → download
   `societyos-resident-debug-apk`.
3. Copy to your phone, tap to install (allow "install unknown apps").

## Before it talks to a real backend

Edit `.github/workflows/android-apk.yml` — set `VITE_API_URL` to your
deployed API (`https://your-domain/api/v1`). The app ships pointing at the
example placeholder otherwise.

## Local build (requires Android Studio/SDK)

```bash
pnpm --filter @societyos/resident-pwa build
cd apps/mobile-app && npm i -D @capacitor/cli@6 && npm i @capacitor/core@6 @capacitor/android@6
npx cap add android && npx cap sync android
cd android && ./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

Debug builds are for testing only; play-store release needs signing keys.
