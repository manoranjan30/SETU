# Plugin Security

SETU Plugin System v1 is intentionally restrictive.

## Security Rules

- Only admin-approved plugin bundles can be installed.
- Plugins are metadata-driven, not arbitrary code packages.
- Plugin permissions must stay under `PLUGIN.<PLUGIN_KEY>.*`.
- Plugins cannot mutate core auth, TypeORM registration, or global runtime internals.
- Remote UI pages are optional and must be explicitly declared.

## Backend Safety

- Plugin manifests are validated before persistence.
- Unknown capabilities are rejected.
- Unsupported page renderer types are rejected.
- Menu/page/report cross-references are validated.

## Uninstall Safety

- Enabled plugins cannot be uninstalled directly.
- Plugin-owned configuration is archived before removal from runtime.
