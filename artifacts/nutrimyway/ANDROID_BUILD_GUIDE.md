# NutriMyWay Android App — Capacitor Build Guide

## What you have

| Component | Status |
|---|---|
| Capacitor 8.4.1 | ✅ Installed |
| Android platform | ✅ Added (`android/` folder) |
| Firebase FCM | ✅ `google-services.json` placed |
| Camera plugin | ✅ `@capacitor/camera@8.2.0` |
| Push Notifications | ✅ `@capacitor/push-notifications@8.1.1` |
| Native camera in Log page | ✅ Wired — uses `snapPhoto()` on Android |
| Push token registration | ✅ Called on login — stores FCM token to backend |
| Android permissions | ✅ `CAMERA`, `POST_NOTIFICATIONS`, storage |
| App icons (5 sizes) | ✅ Generated from your logo |
| Splash screens (10 sizes) | ✅ Generated from your logo |
| Backend push-token route | ✅ `PUT /api/members/:id/push-token` |
| DB migration | ✅ `push_token` + `push_platform` columns on `members` |

---

## Prerequisites (on YOUR machine)

1. **Android Studio** — download from [developer.android.com/studio](https://developer.android.com/studio)
2. **Java 17** — included with Android Studio
3. **Node.js 20+** — [nodejs.org](https://nodejs.org)

---

## Step 1 — Download the Android project

The `android/` folder inside `artifacts/nutrimyway/` is the complete Android project.
You need to **download it from Replit** (File Manager → `artifacts/nutrimyway/android/`) or ZIP it and download.

---

## Step 2 — Open in Android Studio

```bash
# On your machine
# 1. Copy the android folder to your machine
# 2. Open Android Studio → File → Open → select the `android` folder
```

Wait for Gradle sync to finish (first time takes ~5 minutes).

---

## Step 3 — Create your signing keystore

In Android Studio's terminal:

```bash
cd app
# macOS / Linux:
keytool -genkey -v -keystore nutrimyway.keystore -alias nutrimyway -keyalg RSA -keysize 2048 -validity 10000
# Windows:
keytool -genkey -v -keystore nutrimyway.keystore -alias nutrimyway -keyalg RSA -keysize 2048 -validity 10000
```

Remember the passwords — you'll need them for every release.

---

## Step 4 — Configure signing

Edit `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file("nutrimyway.keystore")
            storePassword "YOUR_KEYSTORE_PASSWORD"
            keyAlias "nutrimyway"
            keyPassword "YOUR_KEY_PASSWORD"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

> ⚠️ **Never commit `build.gradle` with real passwords.** Use environment variables or a `local.properties` file.

---

## Step 5 — Build the Release AAB

In Android Studio:

```bash
./gradlew bundleRelease
```

Or use the UI: **Build → Generate App Bundle / APK → Android App Bundle**

Output: `android/app/build/outputs/bundle/release/app-release.aab`

---

## Step 6 — Upload to Play Console

1. Go to [play.google.com/console](https://play.google.com/console)
2. Create app → "NutriMyWay"
3. Go to **Testing → Internal testing** (or Production)
4. Create release → Upload the `.aab` file
5. Fill in store listing (description, screenshots, etc.)
6. Submit for review

---

## Firebase Push Notifications — Important Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → your NutriMyWay project
2. **Project Settings → Cloud Messaging**
3. Copy the **Server key** (legacy) or use the **API key** from `google-services.json`
4. This key is needed on your backend to actually **send** push notifications

Your backend currently stores tokens. To send notifications, you'd add a new admin endpoint (or scheduled job) that calls FCM API with the stored tokens.

---

## After updating the web app

If you change React code later:

```bash
cd artifacts/nutrimyway
PORT=5173 BASE_PATH=/ pnpm run build
./node_modules/.bin/cap sync android
```

Then re-open the `android` folder in Android Studio and rebuild.

---

## Package details

| Property | Value |
|---|---|
| Package name | `com.zerolimitautomation.nutrimyway` |
| App name | `NutriMyWay` |
| Version | `1.0.0` (versionCode 1) |
| Min SDK | 22 (Android 5.1) |
| Target SDK | 35 (Android 15) |

---

## Need help?

1. Gradle sync errors → Run **File → Invalidate Caches / Restart**
2. FCM not registering → Check `google-services.json` is in `android/app/`
3. Camera crashes → Check `AndroidManifest.xml` has `CAMERA` permission
