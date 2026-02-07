# WBS Import Architecture

## Overview
Bulk creation of WBS Nodes via CSV/Excel upload. This feature parses a flat file, reconstructs the hierarchy based on codes/parent-codes, validates rules, and commits to the database.

## Supported Formats
*   **CSV** (`.csv`)
*   **Excel** (`.xlsx`)

## File Structure (Required Columns)
| Column Name | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `WBS_CODE` | Yes | Unique Identifier in File | `1.1.2` |
| `WBS_NAME` | Yes | Display Name | `Foundation Works` |
| `PARENT_WBS_CODE` | No | Parent's `WBS_CODE`. Empty for Root. | `1.1` |
| `DISCIPLINE` | No | Tagging | `Civil` |
| `CONTROL_ACCOUNT` | No | Boolean/Flag (Yes/No, True/False) | `Yes` |

## Validation Logic
1.  **Duplicate Check**: `WBS_CODE` must be unique within the file (and potentially the project, though imports usually append).
2.  **Parent Existence**: If `PARENT_WBS_CODE` is provided, a row with that `WBS_CODE` MUST exist earlier in the file or already exist in the DB (Advanced: Multi-pass resolution).
    *   *Simplification*: Require Parent to be defined in a row *before* the Child, or handle via topological sort.
3.  **Cycle Detection**: No `A -> B -> A`.
4.  ** Depth Limit**: Maximum WBS depth (e.g., 10 levels).

## Process Flow
1.  **Upload**: User selects file -> POST `/projects/:id/wbs/import/preview`.
2.  **Parse & Validate**:
    *   Backend reads file.
    *   Validates constraints.
    *   Returns `PreviewResponse`: `{ validRows: [], errors: [{ row: 2, msg: "Missing Parent" }] }`.
3.  **Confirm**: User reviews errors. If acceptable -> POST `/projects/:id/wbs/import/commit`.
4.  **Execute**: Backend performs bulk `INSERT` (transactional).

## Permissions
| Permission | Description |
| :--- | :--- |
| `WBS.IMPORT` | Ability to run import jobs |
