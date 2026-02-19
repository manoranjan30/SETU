# Flutter Setup Guide for SETU Mobile App

## Step 1: Add Flutter to System PATH (One-time setup)

Flutter is installed at `C:\flutter\flutter\bin` but is NOT in your system PATH. Follow these steps:

### Option A: Add to System PATH (Recommended - Permanent)

1. Press `Windows Key + R`
2. Type `sysdm.cpl` and press Enter
3. Click on **"Advanced"** tab
4. Click **"Environment Variables"** button
5. In the **"System variables"** section (bottom half), find **"Path"** and double-click it
6. Click **"New"**
7. Paste this path: `C:\flutter\flutter\bin`
8. Click **"OK"** on all dialogs
9. **Close all Command Prompt windows and VS Code**
10. Open a new Command Prompt and type `flutter --version` to verify

### Option B: Use PowerShell to add to PATH (Run as Administrator)

```powershell
# Run PowerShell as Administrator, then execute:
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\flutter\flutter\bin", "Machine")
```

After running this, **restart your computer** or log out and log back in.

---

## Step 2: Enable Windows Developer Mode (Required for Windows builds)

1. Press `Windows Key + R`
2. Type `ms-settings:developers` and press Enter
3. Toggle **"Developer Mode"** to ON
4. Confirm the dialog

---

## Step 3: Verify Flutter Installation

Open a **new** Command Prompt and run:

```cmd
flutter --version
flutter doctor
```

You should see Flutter version and a report of what's installed/missing.

---

## Step 4: Build the App

### For Windows Desktop App:
```cmd
cd "c:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\flutter"
flutter build windows --release
```

The built app will be at: `build\windows\x64\runner\Release\`

### For Android APK:
First, install Android Studio from https://developer.android.com/studio

Then:
```cmd
cd "c:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\flutter"
flutter build apk --release
```

The APK will be at: `build\app\outputs\flutter-apk\app-release.apk`

---

## Quick Test (Without Building)

To run the app directly in debug mode:
```cmd
cd "c:\Users\omano\OneDrive - Puravankara Limited\Manoranjan\Antigravity Experiment\000 Project PM\SETU\flutter"
flutter run -d windows
```

---

## Troubleshooting

### "flutter is not recognized"
- Make sure you added `C:\flutter\flutter\bin` to PATH
- Close and reopen Command Prompt/VS Code
- Try logging out and back in

### "Android toolchain not found"
- Install Android Studio
- Open Android Studio → SDK Manager → Install SDK and Command-line Tools

### Windows build fails with symlink errors
- Enable Developer Mode (Step 2 above)

### Visual Studio not found (for Windows builds)
- Install Visual Studio 2022 with "Desktop development with C++" workload
- Download from: https://visualstudio.microsoft.com/downloads/
