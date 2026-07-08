# Android / Play Store Audit

> Comprehensive overview of what's needed to ship TOAST on the Google Play Store.
> Generated from a full codebase review on April 27, 2026.

---

## Summary

TOAST is a React Native 0.84 app built and tested exclusively on iOS. The good news: the Android scaffold already exists, native Kotlin modules are in place (foreground service for trail recording), splash screen assets are generated, sound files are in `res/raw/`, and most of the JS/TS code already handles `Platform.OS` branching where needed. The app is closer to building on Android than you might expect.

The blockers are configuration issues (application ID, signing), not architectural ones. Below is everything that needs to happen, grouped by priority.

---

## 1. Blockers — Must Fix Before `npx react-native run-android` Works

### 1.1 Map Tiles (OpenFreeMap via MapLibre)

**Status:** No API key needed.

The map screen uses `@maplibre/maplibre-react-native` with [OpenFreeMap](https://openfreemap.org/) Liberty tiles. Neither MapLibre nor OpenFreeMap requires an API key — the tile URL is open and free.

No action is needed for the map to work on Android.

### 1.2 Application ID Conflict

**Status:** `com.toast` in `android/app/build.gradle` — this is almost certainly taken on Google Play and is too generic.

**What to do:**

Change the `applicationId` and `namespace` to match your iOS bundle identifier pattern:

```gradle
namespace "studio.toastbyte.toast"
defaultConfig {
    applicationId "studio.toastbyte.toast"
    ...
}
```

This also requires renaming the Java/Kotlin package:

- Move files from `android/app/src/main/java/com/toast/` to `android/app/src/main/java/studio/toastbyte/toast/`
- Update the `package` declaration at the top of each `.kt` file
- Update `AndroidManifest.xml` references (`.MainActivity`, `.MainApplication`, `.LocationForegroundService`)

> **Not done in this PR** because it touches every native file and should be tested immediately on a device. Recommend doing this as a dedicated follow-up.

### 1.3 Release Signing

**Status:** Release builds currently use the debug keystore (`signingConfigs.debug`). Google Play will reject this.

**What to do:**

1. Generate a release keystore:

   ```bash
   keytool -genkeypair -v -storetype PKCS12 -keystore toast-release.keystore \
     -alias toast -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Store the keystore **outside** the repo (it's in `.gitignore` already, good)
3. Add to `~/.gradle/gradle.properties` (never commit these):

   ```properties
   TOAST_RELEASE_STORE_FILE=/path/to/toast-release.keystore
   TOAST_RELEASE_STORE_PASSWORD=your_password
   TOAST_RELEASE_KEY_ALIAS=toast
   TOAST_RELEASE_KEY_PASSWORD=your_password
   ```

4. Update `android/app/build.gradle` signing config:

   ```gradle
   signingConfigs {
       release {
           storeFile file(TOAST_RELEASE_STORE_FILE)
           storePassword TOAST_RELEASE_STORE_PASSWORD
           keyAlias TOAST_RELEASE_KEY_ALIAS
           keyPassword TOAST_RELEASE_KEY_PASSWORD
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           ...
       }
   }
   ```

5. Alternatively, use [Play App Signing](https://developer.android.com/studio/publish/app-signing#app-signing-google-play) (recommended) — Google manages the signing key and you upload with an upload key.

---

## 2. High Priority — Needed for Play Store Submission

### 2.1 Adaptive App Icons

**Status:** The mipmap icons exist at all densities and appear to be custom (not default RN), which is great. However, they are legacy PNG icons — not Android Adaptive Icons.

**Why it matters:** Since Android 8.0 (API 26), the launcher uses adaptive icons that support different shapes (circle, squircle, teardrop) per OEM. Without adaptive icons, your app will look out of place in the app drawer on most modern Android devices.

**What to do:**

1. Create `ic_launcher_foreground.png` (your logo on transparent background) at each density
2. Create `ic_launcher_background.png` (or use a solid color) at each density
3. Add `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`:

   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
       <background android:drawable="@color/ic_launcher_background"/>
       <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
   </adaptive-icon>
   ```

4. Easiest path: use [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html) or Android Studio's Image Asset wizard with your existing icon source file.

### 2.2 Foreground Service Notification Icon

**Status:** `LocationForegroundService.kt` uses `android.R.drawable.ic_menu_mylocation` — a stock system icon. This works but looks unprofessional.

**What to do:** Create a monochrome (white on transparent) notification icon and place it in `res/drawable-*dpi/ic_notification.png`, then reference it in the service:

```kotlin
.setSmallIcon(R.drawable.ic_notification)
```

### 2.3 Play Store Listing Assets

Google Play requires:

- **App icon**: 512×512 PNG (you probably have this from iOS)
- **Feature graphic**: 1024×500 PNG (banner shown at top of listing)
- **Screenshots**: Min 2, max 8. At least phone screenshots; tablet screenshots strongly recommended. Sizes: min 320px, max 3840px on any side.
- **Short description**: Max 80 characters
- **Full description**: Max 4000 characters
- **Privacy policy URL**: Required for apps that access location, camera, contacts, and microphone — all of which TOAST does
- **Category**: Tools or Maps & Navigation
- **Content rating**: Complete the IARC questionnaire in Play Console
- **Target audience**: Declare this is not primarily for children

### 2.4 Privacy Policy

**Status:** Required by Google Play because TOAST accesses location, camera, contacts, and microphone.

You need a publicly accessible URL with a privacy policy. Since TOAST is offline-first and doesn't transmit data, the policy can be straightforward — but it must exist.

### 2.5 Google Play Developer Account

**Status:** You need a [Google Play Developer account](https://play.google.com/console/signup) ($25 one-time fee).

---

## 3. Medium Priority — Should Fix for Quality

### 3.1 Android Permissions UX

**Status:** Already handled correctly in most places. The code properly uses `PermissionsAndroid.request()` for:

- Contacts (ContactPickerModal)
- Microphone (DecibelMeter, VoiceLog)
- Location (MapScreen — including background location upgrade)
- Camera and storage (already declared in manifest)

**One addition made in this PR:** `POST_NOTIFICATIONS` permission added to the manifest for Android 13+ (API 33). Without it, the foreground service notification for trail recording will be silently suppressed. You should also add a runtime permission request before starting the foreground service.

### 3.2 `react-native-sound` on Android

**Status:** Sound files (`dog_whistle.wav`, `sos_dot.wav`, `sos_dash.wav`) are already in `android/app/src/main/res/raw/` — good. The code uses `Sound.MAIN_BUNDLE` which resolves to the correct location on both platforms.

**Potential issue:** `Sound.setCategory('Playback')` (called in DigitalWhistleScreen) is an iOS-only API. On Android it's a no-op, so it won't crash, but audio routing might differ. Test that the digital whistle and morse code sounds play at expected volume on Android.

### 3.3 Barometer Sensor

**Status:** Uses `react-native-sensors` `barometer` API. Not all Android devices have a barometer sensor.

**What to do:** The BarometerStore should gracefully handle the case where the barometer is unavailable. Add a try/catch or check `barometer.pipe()` subscription for errors. If not already handled, show a "Barometer not available on this device" message instead of crashing.

### 3.4 Compass Heading

**Status:** Uses `react-native-compass-heading` in MapScreen. This works on Android but accuracy varies significantly across devices.

**What to do:** Test on a physical Android device. The compass may need calibration prompts (figure-8 gesture) that iOS handles automatically but Android does not.

### 3.5 `react-native-torch` Patch

**Status:** There's a patch (`patches/react-native-torch+1.2.0.patch`) that fixes an iOS-specific issue (`BOOL *` → `BOOL`). The Android side of react-native-torch is unmodified. Should work, but verify the flashlight toggles correctly on Android — some devices have quirks with Camera2 API flashlight control.

### 3.6 `react-native-signature-canvas` (SketchCanvas)

**Status:** Uses a WebView-based canvas. Should work on Android but may have performance differences. Test drawing responsiveness.

### 3.7 ProGuard / R8 Minification

**Status:** ProGuard is disabled (`enableProguardInReleaseBuilds = false`). This is fine for now but means larger APK sizes.

**What to do:** Basic ProGuard rules have been added in this PR for the native libraries in use. When you're ready to enable minification for release builds, set `enableProguardInReleaseBuilds = true` and verify the app doesn't crash (the rules should cover it, but test thoroughly).

### 3.8 Edge-to-Edge Display

**Status:** `edgeToEdgeEnabled=false` in `gradle.properties`. Modern Android (15+) enforces edge-to-edge, so you'll want to enable this eventually and ensure your UI respects safe area insets properly (which it should, since you're already using `react-native-safe-area-context`).

---

## 4. Low Priority — Polish and Optimization

### 4.1 Android App Bundle (AAB) vs APK

**Status:** Google Play requires AAB format (not APK) for new apps.

**What to do:** Build with:

```bash
cd android && ./gradlew bundleRelease
```

The output will be at `android/app/build/outputs/bundle/release/app-release.aab`.

### 4.2 Version Code Strategy

**Status:** `versionCode 1`, `versionName "1.0"` in `build.gradle`. Each Play Store upload requires an incrementing `versionCode`.

**Recommendation:** Keep `versionCode` and `versionName` in sync with iOS. Consider a scheme like `versionCode = major * 10000 + minor * 100 + patch` so version 1.2.3 → versionCode 10203.

### 4.3 APK Size Optimization

- Enable ProGuard/R8 for release builds (see 3.7)
- Consider ABI splits to generate per-architecture APKs:

  ```gradle
  splits {
      abi {
          enable true
          reset()
          include "armeabi-v7a", "arm64-v8a", "x86_64"
          universalApk false
      }
  }
  ```

  However, AAB format handles this automatically, so this is only needed if distributing APKs directly.

### 4.4 Deep Linking

**Status:** Not configured. Not required for launch but useful for sharing specific screens (e.g., a specific reference article or scenario card).

### 4.5 Android Back Button / Gesture Navigation

**Status:** `react-navigation` handles the hardware back button by default. Verify that:

- Back button navigates correctly through the stack
- Back button from the home screen exits the app (not loops)
- Android gesture navigation (swipe from edge) works correctly — note `setDisableGestureNavigation` is used in MapScreen

### 4.6 Status Bar Styling

**Status:** `UIViewControllerBasedStatusBarAppearance` is configured for iOS. On Android, verify the status bar color and icon tint (light/dark) match your theme. The `AppTheme` parent is `Theme.AppCompat.DayNight.NoActionBar` which should auto-adapt.

### 4.7 Tablet Support

**Status:** Not tested on Android tablets per project notes. The portrait-only lock (`android:screenOrientation="portrait"` in manifest) will work but consider if tablets should support landscape.

---

## 5. What Already Works (No Changes Needed)

These areas are already correctly set up for Android:

- **Foreground service** for trail recording — full Kotlin implementation with notification channel
- **NativeModules bridge** — `LocationForegroundServiceModule` + `LocationForegroundServicePackage` registered in `MainApplication`
- **Splash screen** — `react-native-bootsplash` assets generated for all Android densities, `BootTheme` style configured
- **Custom fonts** — Bitter-Regular and Bitter-Bold in `android/app/src/main/assets/fonts/`
- **Sound files** — all `.wav` files in `res/raw/`
- **Platform branching** in JS — `Platform.OS` checks exist in MapScreen, DecibelMeter, VoiceLog, ContactPicker, Notepad, SearchScreen, and backupService
- **Hermes** enabled
- **New Architecture** enabled
- **AndroidX** enabled
- **Gradle 9** + Kotlin 2.1 — modern toolchain
- **All permissions declared** in AndroidManifest (location, camera, mic, storage, foreground service)

---

## 6. Code Changes in This PR

| File                                       | Change                                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `android/app/src/main/AndroidManifest.xml` | Added `POST_NOTIFICATIONS` permission for Android 13+; removed Google Maps API key placeholder (MapLibre + OpenFreeMap need no key) |
| `android/app/proguard-rules.pro`           | Added keep rules for react-native-svg, react-native-sensors, and Hermes; removed react-native-maps section                        |
| `docs/ANDROID_PLAY_STORE_AUDIT.md`         | This document                                                                                                  |

---

## 7. Recommended Sequence

1. **Rename applicationId** from `com.toast` to `studio.toastbyte.toast` (including Kotlin package move)
3. **Run `npx react-native run-android`** on an emulator — fix any build errors
4. **Test on a physical Android device** — verify maps, compass, torch, sounds, barometer, contacts
5. **Generate adaptive icons** from your existing icon source
6. **Set up release signing**
7. **Create Play Store listing** (screenshots, description, privacy policy)
8. **Build AAB and submit** to Play Console
