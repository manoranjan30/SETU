# Flutter Mobile Platform and Feature Documentation

Status: Draft  
Primary wave: F - Platform and Client Operations  
Related modules: Auth, Projects, Sync, Planning, Design, EHS, Labor, Progress, Quality, Settings

## Purpose

Documents the Flutter application shell, dependency injection, navigation, local persistence, networking, authentication, settings, server setup, error handling, and feature parity.

## Code Map

- Entry points: `flutter/lib/main.dart`, `flutter/lib/app.dart`, `flutter/lib/injection_container.dart`
- Feature folders: `flutter/lib/features/auth`, `design`, `ehs`, `labor`, `planning`, `profile`, `progress`, `projects`, `quality`, `server_setup`, `settings`, `sync`, `tower_lens`
- Dependencies/configuration: `flutter/pubspec.yaml`

## Required Documentation

For each feature, record screens, state management, repositories, local models, API calls, permissions, offline support, evidence/files, error states, and parity differences from web. Document app lifecycle, secure storage, sign-out cleanup, server URL setup, platform permissions, build flavors, and release process.

## Testing and Decisions

Test cold start, authentication, project switching, offline queues, sync conflicts, device rotation/backgrounding, file capture, permissions, upgrades, and sign-out cleanup. Confirm supported platforms, minimum OS versions, offline feature list, crash reporting, and release ownership.

