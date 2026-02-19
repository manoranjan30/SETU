# SETU Mobile App

A Flutter-based mobile application for SETU Construction Project Management System. This app enables field workers to report progress offline and sync when connectivity is available.

## Features

- **Authentication**: Secure login with JWT tokens
- **Project Management**: View assigned projects and activities
- **Progress Reporting**: Report progress with quantity, photos, and remarks
- **Offline Support**: Full offline-first architecture with automatic sync
- **Micro Schedule Support**: Report progress against micro activities

## Architecture

This app follows **Clean Architecture** principles with **BLoC** state management:

```
lib/
├── core/                    # Core functionality
│   ├── api/                 # API client and endpoints
│   ├── auth/                # Authentication services
│   ├── database/            # Local database (Drift/SQLite)
│   ├── network/             # Network connectivity
│   ├── sync/                # Offline sync service
│   └── theme/               # App theming
│
├── features/                # Feature modules
│   ├── auth/                # Authentication
│   ├── projects/            # Project listing
│   └── progress/            # Progress reporting
│
└── injection_container.dart # Dependency injection
```

## Getting Started

### Prerequisites

- Flutter SDK 3.2.0 or higher
- Dart SDK 3.2.0 or higher
- Android Studio / VS Code
- Android SDK (for Android builds)
- Xcode (for iOS builds, macOS only)

### Quick Start with Batch Scripts (Windows)

We provide convenient batch scripts for building and testing:

| Script | Purpose |
|--------|---------|
| `setup.bat` | Initial setup (install deps, generate code) |
| `dev_run.bat` | Run app in development mode with hot reload |
| `quick_build.bat` | Quick debug APK build with install option |
| `build_flutter.bat` | Full build script with all options |
| `test_flutter.bat` | Run tests with coverage |

**First-time setup:**
```cmd
cd flutter
setup.bat
```

**Development:**
```cmd
dev_run.bat          # Run with hot reload
quick_build.bat      # Quick build debug APK
```

**Production build:**
```cmd
build_flutter.bat build release
```

**Run tests:**
```cmd
test_flutter.bat all
```

### Manual Installation

1. **Clone the repository**
   ```bash
   cd flutter
   ```

2. **Install dependencies**
   ```bash
   flutter pub get
   ```

3. **Generate database code** (Drift)
   ```bash
   flutter pub run build_runner build
   ```

4. **Configure API endpoint**
   
   Edit `lib/core/api/api_endpoints.dart` and update the `baseUrl`:
   ```dart
   static const String baseUrl = 'http://your-server:3000/api';
   ```

5. **Run the app**
   ```bash
   flutter run
   ```

### Building for Production

**Android APK:**
```bash
flutter build apk --release
```

**Android App Bundle:**
```bash
flutter build appbundle --release
```

**iOS:**
```bash
flutter build ios --release
```

### Build Script Reference

The main build script (`build_flutter.bat`) supports the following commands:

```cmd
build_flutter.bat setup        # Initial project setup
build_flutter.bat deps         # Install dependencies
build_flutter.bat codegen      # Generate database code
build_flutter.bat build [type] # Build APK (debug/release/profile)
build_flutter.bat run [device] # Run app in debug mode
build_flutter.bat test [type]  # Run tests (unit/widget/integration/all)
build_flutter.bat clean        # Clean build artifacts
build_flutter.bat doctor       # Run Flutter doctor
build_flutter.bat help         # Show all commands
```

## Configuration

### API Endpoints

All API endpoints are defined in `lib/core/api/api_endpoints.dart`. Update the base URL for your environment:

```dart
// Development
static const String baseUrl = 'http://localhost:3000/api';

// Production
static const String productionUrl = 'https://api.setu.example.com/api';
```

### Offline Storage

The app uses Drift (SQLite) for local storage. Database tables are defined in `lib/core/database/app_database.dart`.

### Sync Settings

Offline sync is handled automatically by `SyncService`. You can configure:
- Sync retry attempts
- Conflict resolution strategy
- Background sync intervals

## Project Structure

### Core Modules

| Module | Description |
|--------|-------------|
| `api/` | HTTP client with Dio, interceptors, and error handling |
| `auth/` | JWT token management and authentication |
| `database/` | Local SQLite database with Drift ORM |
| `network/` | Connectivity checking with connectivity_plus |
| `sync/` | Offline-first sync service |
| `theme/` | App theming with Material Design 3 |

### Feature Modules

| Feature | Description |
|---------|-------------|
| `auth/` | Login, logout, token refresh |
| `projects/` | Project list, activity navigation |
| `progress/` | Progress entry, BOQ selection, photo capture |

## API Integration

The app connects to the SETU NestJS backend. Key endpoints used:

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/login` | User authentication |
| `GET /eps/my-projects` | Get user's projects |
| `GET /planning/projects/:id/activities` | Get project activities |
| `POST /execution/:projectId/measurements` | Save progress |
| `POST /execution/progress/micro` | Save micro progress |
| `GET /execution/breakdown` | Get execution breakdown |

## Offline-First Architecture

### Data Flow

```
User Action → Local Database → Sync Queue → API (when online)
     ↓              ↓
  UI Update    Background Sync
```

### Sync Status

- **Pending**: Saved locally, waiting to sync
- **Synced**: Successfully synced to server
- **Failed**: Sync failed, will retry

## Dependencies

### Core
- `flutter_bloc` - State management
- `dio` - HTTP client
- `drift` - SQLite database
- `flutter_secure_storage` - Secure token storage

### UI
- `go_router` - Navigation
- `shimmer` - Loading placeholders
- `flutter_slidable` - Swipe actions

### Device
- `camera` - Photo capture
- `geolocator` - GPS location
- `connectivity_plus` - Network status
- `workmanager` - Background tasks

## Testing

```bash
# Run all tests
flutter test

# Run with coverage
flutter test --coverage

# Run integration tests
flutter drive --target=test_driver/app.dart
```

## Troubleshooting

### Build Issues

1. **Drift code generation fails**
   ```bash
   flutter clean
   flutter pub get
   flutter pub run build_runner build --delete-conflicting-outputs
   ```

2. **Android build fails**
   - Ensure Android SDK is properly configured
   - Check `android/app/build.gradle` for correct SDK versions

3. **iOS build fails**
   - Run `pod install` in `ios/` directory
   - Check Xcode signing settings

### Runtime Issues

1. **API connection fails**
   - Check base URL configuration
   - Verify backend is running
   - Check network connectivity

2. **Token refresh fails**
   - Clear app data and re-login
   - Check refresh token endpoint

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## License

This project is proprietary and confidential.

## Support

For issues and feature requests, contact the development team.
