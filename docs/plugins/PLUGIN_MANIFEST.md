# Plugin Manifest

SETU Plugin System v1 uses an admin-approved bundle with these logical files:

- `plugin.json`
- `permissions.json`
- `menus.json`
- `pages.json`
- `widgets.json`
- `reports.json`
- `workflows.json`
- `settings.schema.json`

`pack-plugin.ts` combines those files into one installable bundle JSON.

## `plugin.json`

Required fields:

```json
{
  "pluginKey": "sample-project-insights",
  "name": "Sample Project Insights",
  "version": "1.0.0",
  "author": "SETU",
  "description": "Reference plugin for project-level insights.",
  "appCompatibility": "^0.0.1",
  "capabilities": ["menus", "pages", "widgets", "reports", "workflows", "settings"],
  "installPolicy": {
    "approvalRequired": true
  },
  "uninstallPolicy": {
    "mode": "ARCHIVE",
    "requiresDisableFirst": true
  }
}
```

## Permissions

Every plugin permission must use the namespace:

`PLUGIN.<PLUGIN_KEY_IN_UPPERCASE>.<ACTION>`

Example:

```json
[
  {
    "code": "PLUGIN.SAMPLE-PROJECT-INSIGHTS.VIEW",
    "name": "View Sample Project Insights",
    "moduleName": "PLUGIN",
    "scopeLevel": "PROJECT",
    "actionType": "READ"
  }
]
```

## Menus

Example:

```json
[
  {
    "menuKey": "project-insights",
    "label": "Project Insights",
    "location": "PROJECT",
    "pageKey": "insights-table",
    "permissionCode": "PLUGIN.SAMPLE-PROJECT-INSIGHTS.VIEW",
    "requiresProject": true,
    "sortOrder": 10
  }
]
```

Menu `location` values supported in v1:

- `SIDEBAR`
- `PROJECT`

## Pages

Supported `rendererType` values in v1:

- `hostFormPage`
- `hostTablePage`
- `hostDashboardWidget`
- `hostReportAction`
- `remoteUiPage`

## Reports

Reports are host-controlled. They may use:

- `previewRows`
- `columns`
- `dataSourceKey`
- `queryConfig`

## Workflows

Workflows are metadata in v1. They can declare:

- `workflowKey`
- `moduleCode`
- `processCode`
- `permissionCode`
- `config`

## Settings

Plugin settings are schema-driven and stored by the host application.
