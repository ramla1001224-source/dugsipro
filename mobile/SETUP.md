# Flutter Mobile App — Setup Guide

## Step 1: Install Flutter SDK (After Download Completes)

```powershell
# 1. Extract the downloaded zip
Expand-Archive -Path "$env:USERPROFILE\Downloads\flutter_sdk.zip" -DestinationPath "C:\src" -Force

# 2. Add Flutter to PATH (for current session)
$env:PATH += ";C:\src\flutter\bin"

# 3. Verify installation
flutter --version
```

## Step 2: Set Up Flutter Project

```powershell
cd c:\Users\abdih\OneDrive\Desktop\new\mobile

# Install pub packages
flutter pub get

# Check environment
flutter doctor
```

## Step 3: Run on Android (Physical Device)

Connect your Android phone via USB with **Developer Mode** and **USB Debugging** enabled:

```powershell
# Check connected devices
flutter devices

# Run on connected device
flutter run
```

> The API URL in `lib/config/api_config.dart` auto-uses `10.0.2.2:4000` for emulator.  
> For a **physical phone on the same WiFi**, change it to your PC's local IP:  
> `static const String baseUrl = 'http://192.168.x.x:4000';`

## Step 4: Build Release APK (Android)

```powershell
flutter build apk --release
# Output: build\app\outputs\flutter-apk\app-release.apk
# Install on any Android phone directly
```

## Step 5: iOS (Needs macOS + Xcode)

```bash
# On a Mac with Xcode:
cd mobile
flutter pub get
flutter build ios --no-codesign
# Then open ios/Runner.xcworkspace in Xcode to deploy
```

## API Configuration

Edit `lib/config/api_config.dart`:

| Where to Run | Base URL |
|---|---|
| Android Emulator | `http://10.0.2.2:4000` |
| Physical Phone (WiFi) | `http://YOUR_PC_IP:4000` |
| Production | `https://api.yourschool.so` |
