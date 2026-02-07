
# Valid Git Strategy for SETU Project

This document outlines the branching strategy, commit conventions, and best practices for managing the codebase.

## 1. Branching Strategy (Git Flow Lite)

We follow a simplified Git Flow model:

### 1.1 `main` (Production)
- Contains stable, tested, and deployable code.
- Direct pushes are restricted; only merges from `develop` or release branches are allowed.
- Tags (`v1.0.0`) mark releases.

### 1.2 `develop` (Integration)
- The primary branch for ongoing development.
- Features are merged here once completed.
- Automated tests run on this branch.

### 1.3 Feature Branches (`feature/xyz`)
- Created from: `develop`
- Merged back into: `develop`
- Naming Convention: `feature/short-description` (e.g., `feature/add-auth`, `feature/fix-login-bug`)

### 1.4 Hotfix Branches (`hotfix/xyz`)
- Created from: `main` (for critical bugs in production)
- Merged back into: `main` AND `develop`
- Naming Convention: `hotfix/short-description`

## 2. Commit Message Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation

**Example:**
```
feat(auth): add google sign-in support
fix(api): handle null pointer exception in user service
docs: updat readme with installation steps
```

## 3. Pull Request Guidelines

- Provide a clear title and description.
- Link to relevant Jira/Trello tickets.
- Ensure all tests pass.
- Request review from at least one teammate.

## 4. Requirement Files & Dependencies

### Node.js Projects (Backend & Frontend)
For Node.js projects, dependencies are managed via `package.json`.
- Do **NOT** commit `node_modules`.
- Commit `package.json` and `package-lock.json` (or `yarn.lock`) to ensure consistent dependency versions across environments.

### Requirements File
- Refer to `REQUIREMENTS.md` for system-level prerequisites (Node.js version, Databases, etc).

## 5. Ignoring Files

We use a root-level `.gitignore` to exclude:
- Dependencies (`node_modules`)
- Build outputs (`dist`, `build`, `coverage`)
- Environment variables (`.env`, `*.local`)
- IDE settings (`.vscode`, `.idea`)
- Logs (`logs`, `*.log`)

**If files were accidentally tracked:**
Run the following to un-track ignored files:
```bash
git rm -r --cached .
git add .
git commit -m "chore: untrack ignored files"
```
