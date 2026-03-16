# SETU THEME SYSTEM - MASTER INDEX

## Plan Files

| File | Phase | Status | Platform |
|---|---|---|---|
| [THEME_SYSTEM_PHASE2.md](./THEME_SYSTEM_PHASE2.md) | Foundation | Implemented | React Frontend |
| [THEME_SYSTEM_PHASE3.md](./THEME_SYSTEM_PHASE3.md) | Enterprise Rollout | Implemented | React Frontend |

## Current Theme Catalog
- Shadcn Admin
- TailAdmin
- Horizon UI
- Berry Dashboard
- Mantis
- SETU Modern Pro

## Active Architecture
1. User selects theme from profile/sidebar picker.
2. `ThemeContext` persists user-scoped theme in localStorage.
3. HTML root gets `theme-{name}` class.
4. CSS variables drive app surfaces, typography contrast, and semantic states.
5. Chart palettes resolve via `theme/chartColors.ts`.

## Enterprise Notes
- Opaque overlay strategy enabled to avoid text overlap.
- Dark-theme compatibility rules added for legacy gray/slate utility usage.
- Motion primitives include reduced-motion fallback.
