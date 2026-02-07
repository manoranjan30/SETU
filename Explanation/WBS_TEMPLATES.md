# WBS Templates Architecture

## Overview
WBS Templates allow the standardization of project structures. Admin users can define standard WBS hierarchies for different types of projects (e.g., "High Rise Residential", "Commercial Complex"). These templates can be "Applied" to a new Project to generate specific WBS Nodes rapidly.

## Data Model

### Entity: `WbsTemplate`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | PK (Int) | Unique Identifier |
| `templateName` | String | e.g., "Standard High Rise" |
| `description` | String | |
| `projectType` | String | Filter category (e.g., "Residential") |
| `constructionTech` | String | Filter category (e.g., "Mivan", "Conventional") |
| `isActive` | Boolean | Enable/Disable usage |

### Entity: `WbsTemplateNode`
Recursive structure similar to `WbsNode` but belonging to a Template.

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | PK (Int) | Unique Identifier |
| `templateId` | FK (Int) | Link to Template |
| `parentId` | FK (Int) | Self-reference for hierarchy |
| `wbsCode` | String | Relative Code (e.g., "1.1") |
| `wbsName` | String | e.g., "Substructure" |
| `isControlAccount` | Boolean | Default setting |

## Logic: Applying a Template
1.  **Input**: `ProjectId`, `TemplateId`.
2.  **Process**:
    *   Fetch all `WbsTemplateNodes` for the template.
    *   Traverse the tree (Root -> Leaves).
    *   For each Template Node, create a real `WbsNode`.
    *   **Code Generation**: Prefix with Project Code? Or Use Template Code? (Decision: Use Project Code logic for Roots, append Template relative code).
3.  **Result**: A fully populated WBS tree in the Project, ready for customization.

## Permissions
| Permission | Description |
| :--- | :--- |
| `WBS.TEMPLATE.READ` | View available templates |
| `WBS.TEMPLATE.MANAGE` | Create/Edit/Delete Templates (Admin usually) |
| `WBS.TEMPLATE.APPLY` | Apply a template to a project |
