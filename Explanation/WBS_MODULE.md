# WBS Module (Work Breakdown Structure)

## 🏛️ Architectural Statement
**WBS is the execution structure of a project.**
*   It belongs to a **Project** (EPS Node).
*   It is **Hierarchical**.
*   It is the **Foundation** for Schedule (Activities) and Cost (Budget).
*   It contains **NO** dates, costs, or activities directly (Separation of Concerns).

## 🎯 Objective
*   Define the "What" of the project.
*   Break down project scope into manageable chunks ("Control Accounts").
*   Assign ownership (Who is responsible).

## 🧱 Data Model: `WbsNode`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | PK | Unique ID |
| `project_id` | FK | Links to EPS Project |
| `parent_id` | FK | Self-reference (Hierarchy) |
| `wbs_code` | String | Auto-generated (e.g., 1.2.1) |
| `wbs_name` | String | Description |
| `is_control_account` | Bool | Is this a cost/schedule summary point? |
| `responsible_user_id` | FK | User owning this package |
| `responsible_role_id` | FK | Role owning this package |
| `status` | Enum | Active / Inactive |

## 🔐 Security & Permissions
### Guards
1.  **JwtAuthGuard**: User is valid.
2.  **ProjectContextGuard**: Headers identify the Project.
3.  **ProjectAssignmentGuard**: User is a member of the Project Team.
4.  **RolePermissionGuard**: User has `WBS.*` permission.

### Permissions
*   `WBS.READ`: View the structure.
*   `WBS.CREATE`: Add nodes.
*   `WBS.UPDATE`: Edit names, move nodes.
*   `WBS.DELETE`: Delete LEAF nodes only.

## 🖥️ UI / UX Flow
### 1. WBS Dashboard
*   **Tree View**:
    *   Left side: Hierarchical Tree.
    *   Columns: WBS Code, Name, Control Account (Y/N).
    *   Actions: Add Child, Edit, Delete, Move Up/Down.

### 2. Details Panel (Right Side)
*   **General**: Name, Status, Control Account.
*   **Responsibility**:
    *   **User Picker**: Shows *only* Project Team Members.
    *   **Role Picker**: Shows generic Roles.

## 🚦 Rules & Constraints (Non-Negotiable)
1.  **Project Isolation**: A WBS node MUST belong to one Project. Cross-project linking is forbidden at this layer.
2.  **No Activities**: WBS is for *Deliverables*. Activities (Tasks) belong to the Schedule module and will link TO a WBS node.
3.  **No Direct Costs**: Costs are tracked via Cost Codes or Assignments linked TO a WBS node.

## 🔮 Integration Notes (Future)
*   **Schedule**: Activities will have a `wbs_node_id` FK.
*   **Budget**: Cost items will link to `wbs_node_id` (Control Accounts).
