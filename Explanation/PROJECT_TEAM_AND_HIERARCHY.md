# Project Team & Hierarchy Assignment Module (Architectural Spec)

## 🏛️ Architectural Statement
Project assignment is the **primary security boundary**.
*   **Roles** define capabilities (What you can do).
*   **EPS Hierarchy** defines scope (Where you can do it).
*   **Users** must see *only* assigned projects.
*   **Inheritance** applies automatically from parent to child nodes.

## 🎯 Objective
Build a system that:
1.  Manages project team members.
2.  Assigns roles at project and hierarchy levels.
3.  Enforces permission inheritance.
4.  Integrates with existing User/Role/EPS modules.

## 1️⃣ UI Flows
### A. Project → Team Screen
*   **Location**: Project > Team Tab
*   **View**: Table listing `User | Role | Scope | Actions`.
*   **Rules**:
    *   Visible only with `PROJECT.TEAM.READ`.
    *   Edit actions only with `PROJECT.TEAM.MANAGE`.
    *   Strict visibility: Unassigned users never appear.

### B. Add / Edit Team Member Modal
*   **Step 1: User**: Search/Select Active Users.
*   **Step 2: Role**: Select Role (e.g., Project Manager, Site Engineer).
*   **Step 3: Access Scope**:
    *   **(o) Full Project Access**: Grants access to the Project Node and ALL descendants.
    *   **( ) Hierarchy Limited**: Grants access ONLY to a specific sub-node (Block/Tower/Floor) and its descendants.
        *   *Selection*: **Tree Picker** shows the project's heirarchy. Users can pick any descendant node (Block/Tower/Floor).
        *   *Restriction*: Selecting the Project Root is blocked (must use "Full Access").
*   **Step 4: Save**: Commits to `user_project_assignment`.

### C. Hierarchy Role Assignment (Advanced)
*   **Context**: Right-click on EPS Tree Node > "Assign Team".
*   **Logic**:
    *   Parent hierarchy permissions are **inherited**.
    *   Child permissions are **explicit** (unless inherited).

## 2️⃣ Permission Checks & Guards
### Required Permissions
| Action | Permission |
| :--- | :--- |
| View Project Team | `PROJECT.TEAM.READ` |
| Add / Remove Team | `PROJECT.TEAM.MANAGE` |
| Assign Hierarchy Role | `PROJECT.HIERARCHY.MANAGE` |

### Guard Execution Order (Strict)
1.  **JwtAuthGuard**: Validates Identity.
2.  **ProjectContextGuard**: Identifies Target Project.
3.  **ProjectAssignmentGuard**: Verifies User is in the Team (Primary Gate).
4.  **RolePermissionGuard**: Verifies Role has specific capability.
5.  **EpsScopeGuard**: (If Limited) Verifies target Node is within `scopeNodeId`.

## 3️⃣ Backend Data Model
**Table**: `user_project_assignment`
*   `user_id`: FK User
*   `project_id`: FK EpsNode
*   `role_id`: FK Role
*   `scope_type`: ENUM('FULL', 'LIMITED')
*   `scope_node_id`: FK EpsNode (Nullable, Required if LIMITED)
*   `status`: 'ACTIVE' | 'INACTIVE'

## 4️⃣ Non-Negotiable Rules (Compliance Check)
*   ✅ **No EPS role assignment without project team membership**: Enforced by schema.
*   ✅ **No project visibility without assignment**: Enforced by `EpsService.findAll`.
*   ✅ **No permission checks bypassing guards**: Enforced by Global Guard wiring.
*   ✅ **EPS used only for scope resolution**: Permissions are Role-based, not Node-based.

## Example Scenarios
*   **Scenario 1**: "Site Engineer" assigned to "Tower A".
    *   Can view Project? Yes (Limited context).
    *   Can view Tower A? Yes.
    *   Can view Tower B? **NO**.
*   **Scenario 2**: "Project Manager" assigned to "Project X".
    *   Can view Tower A & B? **Yes** (Inheritance).
