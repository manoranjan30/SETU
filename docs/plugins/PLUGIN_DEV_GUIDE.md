# Plugin Developer Guide

## Folder Structure

```text
plugins-sdk/
  examples/
    sample-project-insights-plugin/
      plugin.json
      permissions.json
      menus.json
      pages.json
      widgets.json
      reports.json
      workflows.json
      settings.schema.json
```

## Local Workflow

1. Copy the sample plugin folder.
2. Update `plugin.json`.
3. Define permissions with `PLUGIN.<PLUGIN_KEY>.*`.
4. Add menus/pages/widgets/reports/workflows/settings.
5. Run:

```bash
node plugins-sdk/inspect-plugin.ts plugins-sdk/examples/sample-project-insights-plugin
node plugins-sdk/validate-plugin.ts plugins-sdk/examples/sample-project-insights-plugin
node plugins-sdk/pack-plugin.ts plugins-sdk/examples/sample-project-insights-plugin
```

6. Upload the generated `plugin.bundle.json` in the Plugin Registry page.

## Page Types

- `hostFormPage`: host renders a schema-style form preview
- `hostTablePage`: host renders a table, optionally backed by a host data source
- `hostDashboardWidget`: host renders declared widgets
- `hostReportAction`: host renders a report launcher
- `remoteUiPage`: host renders an approved iframe-based remote page

## Good Plugin Pattern

- Use project-scoped permissions
- Keep page configs declarative
- Reuse host data sources where possible
- Prefer simple report/table pages for v1

## Invalid Plugin Pattern

- Custom backend runtime code
- Custom database entities
- Permission codes outside the plugin namespace
- Unknown capability or renderer types
