# SETU Codebase Documentation

> This document outlines the project structure, technology stack, and key dependencies.

---

## 🏗️ Project Structure

The project is a monorepo containing:

- **Backend:** NestJS API Server
- **Frontend:** React + Vite Web Application
- **Mobile:** Flutter Native Application
- **Tools:** Python/Bash utility scripts
- **Agent:** AI assistance configuration

### Directory Map

```plaintext
/
├── backend/                 # NestJS Application
│   ├── src/                 # Source code
│   │   └── quality/         # Quality Module (Activities, RFI, Sequence)
│   ├── test/                # E2E tests
│   ├── package.json         # Dependencies
│   └── tsconfig.json        # TypeScript configuration
│
├── frontend/                # React Application
│   ├── src/                 # Components, Pages, Context
│   │   └── views/quality/   # Activity Lists, Seq Manager, RFI Pages
│   ├── public/              # Static assets
│   ├── vite.config.ts       # Build configuration
│   └── package.json         # Dependencies
│
├── flutter/                 # 📱 Mobile Application (Flutter)
│   ├── lib/                 # Dart source code
│   ├── android/             # Android native code
│   ├── ios/                 # iOS native code
│   ├── pubspec.yaml         # Dependencies
│   └── test/                # Widget/Unit tests
│
├── tools/                   # Utility scripts (Python, etc.)
│
└── .agent/                  # AI Agent Context
    ├── skills/              # Domain knowledge
    ├── agents/              # Persona definitions
    └── scripts/             # Validation scripts
```

---

## 🛠️ Technology Stack

### Backend
- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** TypeORM
- **Authentication:** JWT, Passport

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** React Context / Redux (where applicable)
- **UI Components:** Radix UI / Shadcn (implied)

### Mobile (New)
- **Framework:** Flutter (Google)
- **Language:** Dart
- **Target Platforms:** Android, iOS
- **Architecture:** Provider / Riverpod / BLoC (TBD)

---

## 📦 Key File Dependencies

- `backend/.env` - Database & Auth secrets
- `frontend/.env` - API URL configuration
- `flutter/.env` (TBD) - API Endpoints

---

## 🔄 Data Flow

1. **Frontend/Mobile** request data via REST API.
2. **Backend** processes request, interacts with **PostgreSQL**.
3. **Backend** returns JSON response.
4. **Real-time:** (Future) WebSockets via NestJS Gateway.

---

## 🚀 Development Workflow

1. Start Database (Docker/Local)
2. Start Backend (`npm run start:dev`)
3. Start Frontend (`npm run dev`)
4. Start Mobile (`flutter run`)

