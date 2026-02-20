# SETU Mobile App - Batch Scripts Index

This document provides a comprehensive index of all batch scripts available for the SETU Mobile App development.

---

## Quick Reference Table

| S.No | Script Name | Purpose | When to Use |
|------|-------------|---------|-------------|
| 01 | [setup.bat](#01-setupbat) | Initial project setup | First time after cloning |
| 02 | [build_flutter.bat](#02-build_flutterbat) | Full build script with multiple commands | Building, testing, running |
| 03 | [quick_build.bat](#03-quick_buildbat) | Quick debug APK build | Fast development builds |
| 04 | [dev_run.bat](#04-dev_runbat) | Development mode with hot reload | Active development |
| 05 | [test_flutter.bat](#05-test_flutterbat) | Run all tests | Testing code |
| 06 | [build_android.bat](#06-build_androidbat) | Build Android APK (Release) | Creating release APK |
| 07 | [clean_build.bat](#07-clean_buildbat) | Clean and rebuild from scratch | Fixing build issues |
| 08 | [configure_and_build.bat](#08-configure_and_buildbat) | Interactive build menu | Multiple platform builds |
| 09 | [diagnose_network.bat](#09-diagnose_networkbat) | Network diagnostics | Connection troubleshooting |
| 10 | [install_to_device.bat](#10-install_to_devicebat) | Install APK to device | Deploying to physical device |
| 11 | [run_emulator.bat](#11-run_emulatorbat) | Launch emulator and run app | Testing on emulator |
| 12 | [setup_firewall.bat](#12-setup_firewallbat) | Configure Windows Firewall | Enable network access |
| 13 | [show_ips.bat](#13-show_ipsbat) | Display system IP addresses | Finding backend URL |
| 14 | [view_logs.bat](#14-view_logsbat) | Real-time log viewer | Debugging on device |

---

## Detailed Documentation

### 01. setup.bat

**Purpose:** Initial project setup script that prepares the Flutter environment for development.

**What it does:**
1. Checks Flutter installation (searches common paths)
2. Installs all dependencies (`flutter pub get`)
3. Generates database code (Drift/SQLite)
4. Formats code
5. Analyzes code for issues
6. Runs Flutter doctor

**When to use:**
- First time after cloning the project
- After major dependency updates
- When setting up a new development environment

**How to use:**
```batch
# Navigate to scripts folder and run
cd flutter\scripts
01_setup.bat
```

**Prerequisites:**
- Flutter SDK installed
- Android Studio (for Android development)
- Internet connection (to download dependencies)

---

### 02. build_flutter.bat

**Purpose:** Comprehensive build script with multiple commands for building, testing, and running the Flutter app.

**What it does:**
Provides a command-line interface for all Flutter operations including:
- `setup` - Initial project setup
- `deps` - Install dependencies
- `codegen` - Generate code
- `build` - Build APK (debug/release/profile)
- `run` - Run app in debug mode
- `test` - Run tests
- `clean` - Clean build artifacts
- `doctor` - Run Flutter doctor
- `apk` - Build APK
- `ios` - Build iOS (requires macOS)
- `web` - Build for web
- `all` - Build all platforms
- `dev` - Development mode

**When to use:**
- For any build operation
- When you need specific build types
- For running tests

**How to use:**
```batch
# Show help
02_build_flutter.bat help

# Initial setup
02_build_flutter.bat setup

# Build release APK
02_build_flutter.bat build release

# Build debug APK
02_build_flutter.bat build debug

# Run app
02_build_flutter.bat run

# Run all tests
02_build_flutter.bat test all

# Clean build artifacts
02_build_flutter.bat clean
```

---

### 03. quick_build.bat

**Purpose:** Quick build script for fast debug APK generation.

**What it does:**
1. Checks dependencies
2. Builds debug APK
3. Optionally installs on connected device

**When to use:**
- Quick development iterations
- When you need a fast debug build
- When you want to install immediately after build

**How to use:**
```batch
03_quick_build.bat
# When prompted, press Y to install on connected device
```

**Output:**
- APK location: `flutter\build\app\outputs\flutter-apk\app-debug.apk`

---

### 04. dev_run.bat

**Purpose:** Run the app in development mode with hot reload enabled.

**What it does:**
1. Lists connected devices
2. Allows device selection
3. Runs app with hot reload

**When to use:**
- Active development
- When you need hot reload for quick changes
- Testing on specific devices

**How to use:**
```batch
04_dev_run.bat
# Enter device ID when prompted, or press Enter for first available device
```

**Hot Reload Controls:**
- `r` - Hot reload
- `R` - Hot restart
- `h` - List available commands
- `q` - Quit

---

### 05. test_flutter.bat

**Purpose:** Run Flutter tests with coverage reporting.

**What it does:**
- Runs unit tests
- Runs widget tests
- Runs integration tests
- Generates coverage report

**When to use:**
- Before committing code
- When testing new features
- For CI/CD pipelines

**How to use:**
```batch
# Run all tests
05_test_flutter.bat all

# Run unit tests only
05_test_flutter.bat unit

# Run widget tests only
05_test_flutter.bat widget

# Run integration tests
05_test_flutter.bat integration
```

**Output:**
- Coverage report: `coverage\lcov.info`

---

### 06. build_android.bat

**Purpose:** Build Android APK with release configuration.

**What it does:**
1. Accepts Android licenses
2. Installs dependencies
3. Generates database code
4. Builds release APK

**When to use:**
- Creating release builds
- Preparing APK for distribution
- When you need optimized APK

**How to use:**
```batch
06_build_android.bat
# Press 'y' and Enter for each license prompt
```

**Output:**
- APK location: `flutter\build\app\outputs\flutter-apk\app-release.apk`

---

### 07. clean_build.bat

**Purpose:** Clean all build artifacts and rebuild from scratch.

**What it does:**
1. Stops Gradle daemon
2. Deletes all build directories
3. Reinstalls dependencies
4. Regenerates code
5. Builds debug APK

**When to use:**
- When builds are failing unexpectedly
- After major code changes
- When experiencing caching issues
- When Gradle/Flutter is behaving strangely

**How to use:**
```batch
07_clean_build.bat
```

**Note:** Close all VS Code, Android Studio, and Java processes before running for best results.

---

### 08. configure_and_build.bat

**Purpose:** Interactive menu for building different platforms.

**What it does:**
1. Checks Flutter installation
2. Runs Flutter doctor
3. Provides menu for:
   - Build Windows Desktop App
   - Build Android APK
   - Run in Debug Mode (Windows)

**When to use:**
- When building for multiple platforms
- When you want an interactive menu
- For Windows desktop builds

**How to use:**
```batch
08_configure_and_build.bat
# Enter your choice (1-4) when prompted
```

**Options:**
1. Build Windows Desktop App
2. Build Android APK
3. Run in Debug Mode (Windows)
4. Exit

---

### 09. diagnose_network.bat

**Purpose:** Diagnose network connectivity issues between mobile app and backend.

**What it does:**
1. Checks Docker containers status
2. Verifies port 3000 is listening
3. Checks Windows Firewall rules
4. Displays all system IP addresses
5. Tests local API connection
6. Tests WiFi IP connection
7. Shows troubleshooting guide

**When to use:**
- When mobile app cannot connect to backend
- When testing network connectivity
- When setting up the app for first time

**How to use:**
```batch
09_diagnose_network.bat
```

**Troubleshooting Steps Provided:**
1. Ensure phone is on same WiFi network as PC
2. Test from phone browser
3. Check Windows Network Profile (Private vs Public)
4. Disable Windows Firewall temporarily
5. Check router settings for AP Isolation

---

### 10. install_to_device.bat

**Purpose:** Install APK to connected Android device via ADB.

**What it does:**
1. Displays system IP addresses
2. Checks for connected devices
3. Supports wireless ADB connection
4. Gets device information
5. Installs APK to device

**When to use:**
- Deploying to physical device
- When you want to install via ADB
- For wireless installation

**How to use:**
```batch
10_install_to_device.bat
# Follow prompts to connect device if not already connected
```

**Connection Options:**
- USB Connection: Enable USB Debugging, connect cable
- Wireless: Enable Wireless Debugging, enter IP:Port

---

### 11. run_emulator.bat

**Purpose:** Launch Android emulator and run the app.

**What it does:**
1. Finds Flutter SDK from common paths
2. Checks Android SDK
3. Lists available devices
4. Provides options to:
   - Run on connected device
   - Launch Android Emulator
   - Choose specific device

**When to use:**
- Testing on emulator
- When you don't have a physical device
- For automated testing

**How to use:**
```batch
11_run_emulator.bat
# Select option (1-4) when prompted
```

**Options:**
1. Run on connected device/emulator
2. Launch Android Emulator
3. Show devices and choose
4. Exit

---

### 12. setup_firewall.bat

**Purpose:** Configure Windows Firewall to allow backend connections.

**What it does:**
1. Checks for Administrator privileges
2. Adds inbound rule for port 3000
3. Adds outbound rule for port 3000
4. Displays current firewall rules

**When to use:**
- When mobile app cannot connect to backend
- First time setup
- After Windows updates that reset firewall

**How to use:**
```batch
# Must run as Administrator!
# Right-click and select "Run as administrator"
12_setup_firewall.bat
```

**Important:** This script requires Administrator privileges.

---

### 13. show_ips.bat

**Purpose:** Display all system IP addresses for backend URL configuration.

**What it does:**
1. Displays all IPv4 addresses
2. Identifies main IP for backend URL
3. Shows connected Android devices

**When to use:**
- Finding your PC's IP address
- Configuring backend URL in mobile app
- Verifying network configuration

**How to use:**
```batch
13_show_ips.bat
```

**Output:**
- Your system IP addresses
- Recommended backend URL format: `http://[IP]:3000`
- Connected Android devices

---

### 14. view_logs.bat

**Purpose:** Real-time log viewer for debugging on connected device.

**What it does:**
1. Checks for connected device
2. Provides filtering options
3. Streams logcat output in real-time

**When to use:**
- Debugging issues on device
- Viewing API calls
- Checking errors in real-time

**How to use:**
```batch
14_view_logs.bat
# Enter filter when prompted (or press Enter for all Flutter logs)
```

**Filter Options:**
- `flutter` - All Flutter logs (default)
- `API` - API calls only
- `ERROR` - Errors only
- `AUTH` - Authentication logs
- `DB` - Database logs
- `USER` - User actions
- `SYNC` - Sync logs

**Controls:**
- `Ctrl+C` - Stop log streaming

---

## Common Workflows

### First Time Setup
```batch
# 1. Run setup
cd flutter\scripts
01_setup.bat

# 2. Configure firewall (as Administrator)
12_setup_firewall.bat

# 3. Get your IP
13_show_ips.bat

# 4. Update backend URL in lib/core/api/api_endpoints.dart
```

### Development Cycle
```batch
# Quick development
04_dev_run.bat

# Or build and install
03_quick_build.bat
```

### Release Build
```batch
# Clean build
07_clean_build.bat

# Or release build
06_build_android.bat
```

### Troubleshooting Connection Issues
```batch
# 1. Diagnose network
09_diagnose_network.bat

# 2. Setup firewall (as Administrator)
12_setup_firewall.bat

# 3. Check IPs
13_show_ips.bat
```

### Debugging on Device
```batch
# 1. Install app
10_install_to_device.bat

# 2. View logs
14_view_logs.bat
```

---

## Notes

1. **Administrator Privileges:** Scripts `12_setup_firewall.bat` requires Administrator privileges.

2. **Flutter Path:** All scripts automatically detect Flutter from common installation paths. If Flutter is not found, you'll be prompted to enter the path.

3. **OneDrive Issues:** If you encounter file locking issues with OneDrive, close VS Code and other applications before running clean builds.

4. **Android SDK:** Most scripts require Android SDK to be installed. Install Android Studio for the complete SDK.

5. **Network Requirements:** For device testing, ensure:
   - Phone and PC are on the same WiFi network
   - Windows Firewall allows port 3000
   - Backend server is running

---

## Support

For issues or questions, refer to:
- [SETUP_GUIDE.md](../SETUP_GUIDE.md) - Detailed setup instructions
- [README.md](../README.md) - Project overview
