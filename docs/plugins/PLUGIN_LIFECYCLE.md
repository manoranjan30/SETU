# Plugin Lifecycle

## Install

1. Developer creates plugin folder.
2. Developer validates it with `validate-plugin.ts`.
3. Developer packages it with `pack-plugin.ts`.
4. Admin uploads the bundle in `Admin > Plugins`.
5. Backend validates compatibility, permissions, and page types.
6. Plugin becomes enabled after a successful install.

## Disable

- Plugin menus/routes disappear from runtime manifest.
- Plugin configuration data stays intact.

## Uninstall

- Plugin must be disabled first.
- Uninstall archives plugin-owned configuration in the install record.
- Runtime registrations are removed from the manifest.

## Audit

Every install, enable, disable, uninstall, and settings update is recorded in `plugin_audit_log`.
