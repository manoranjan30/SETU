Implement EPS similar to Primavera P6 with the following fixed hierarchy levels:

Level 1 – Company (Root)
Level 2 – Project
Level 3 – Block / Building Series
Level 4 – Tower
Level 5 – Floor / Level


Each node:

Belongs to one parent

Can have multiple children

Inherits access control from parent

📦 SCOPE (STRICT)
1. EPS Node Management

Create EPS node

View EPS hierarchy (tree)

Update EPS node

Delete EPS node (with validation)

Reorder nodes within same parent

2. Hierarchy Rules

Root node must be Company

Level enforcement (cannot skip levels)

Child node type must match hierarchy definition

Prevent deletion if child nodes exist (soft delete preferred)

3. Role-Based Access (Reuse Existing Auth)

EPS visibility based on role

Create / Edit / Delete permissions per level

Read-only access for limited roles

🧱 Backend Requirements

Tree-based EPS data model (Adjacency List or Materialized Path)

REST APIs:

Create EPS node

Fetch full EPS tree

Fetch subtree by node

Update node

Delete node

Validation rules for hierarchy levels

Audit fields (created_by, updated_by)

🎨 Frontend Requirements

EPS Tree View (expand / collapse)

Create node modal:

Auto-detect allowed child level

Edit node UI

Delete confirmation with validation message

Role-based UI controls (disable unauthorized actions)

🧪 Physical Verification (MANDATORY)

Create Company root

Add Project under Company

Add Block → Tower → Floor

Try invalid hierarchy → must fail

Role-restricted user → limited access

Delete node with children → blocked

📁 Documentation Requirement

Create folder (if not exists):

/Explanation


Create file:

/Explanation/EPS_MODULE.md


File must include:

EPS overview (Primavera P6 comparison)

Hierarchy rules explanation

Backend EPS data model

Frontend EPS behavior

Flow diagrams:

EPS Creation Flow
[User Action]
      |
      v
[Check Role Permission]
      |
      v
[Validate Parent Level]
      |
      v
[Create EPS Node]
      |
      v
[Refresh Tree]

EPS Hierarchy Diagram
Company
 └── Project
      └── Block
           └── Tower
                └── Floor


What is implemented

What is explicitly not implemented

🚦 Rules (NON-NEGOTIABLE)

❌ Do NOT rebuild authentication or authorization

❌ Do NOT implement scheduling, WBS, activities, or cost

❌ Do NOT add future EPS extensions

✅ EPS only

✅ Fully working backend + frontend

✅ Clean, extensible code

✅ Completion Criteria

Module is complete only when:

EPS hierarchy works end-to-end

UI reflects hierarchy accurately

Role permissions are enforced

Explanation file is complete

Manual testing passes



Project properties or core attributes are mentioned Below. add an provision to add all this properties and keep default value as and fill higher level value automatically

Below is the Property list in json format. impliment this in smart way keeping rules in mind

{
  "project_properties": [
    {
      "group": "Core Identity",
      "fields": [
        {"key": "project_code", "label": "Project Code", "type": "string", "required": true},
        {"key": "project_name", "label": "Project Name", "type": "string", "required": true},
        {"key": "project_type", "label": "Project Type", "type": "enum", "options": ["Residential", "Commercial", "Infrastructure", "Mixed"], "required": true},
        {"key": "project_category", "label": "Project Category", "type": "string"},
        {"key": "project_status", "label": "Project Status", "type": "enum", "options": ["Planned", "Active", "On-Hold", "Closed"]},
        {"key": "project_version", "label": "Project Version", "type": "string"},
        {"key": "description", "label": "Description", "type": "text"}
		{"key": "RERA Registration Number", "label": "RERA Registration Number", "type": "text"}
		{"key": "RERA Registration End Date", "label": "RERA Registration End Date", "type": "date"}
		
      ]
    },
    {
      "group": "Organization & Governance",
      "fields": [
        {"key": "owning_company", "label": "Owning Company", "type": "string"},
        {"key": "business_unit", "label": "Business Unit", "type": "string"},
        {"key": "project_sponsor", "label": "Project Sponsor", "type": "user"},
        {"key": "project_manager", "label": "Project Manager", "type": "user"},
        {"key": "planning_manager", "label": "Planning Manager", "type": "user"},
        {"key": "cost_controller", "label": "Cost Controller", "type": "user"},
        {"key": "approval_authority", "label": "Approval Authority", "type": "user"}
      ]
    },
    {
      "group": "Location & Site",
      "fields": [
        {"key": "country", "label": "Country", "type": "string"},
        {"key": "state", "label": "State / Region", "type": "string"},
        {"key": "city", "label": "City", "type": "string"},
        {"key": "site_address", "label": "Site Address", "type": "text"},
        {"key": "latitude", "label": "Latitude", "type": "number"},
        {"key": "longitude", "label": "Longitude", "type": "number"},
        {"key": "land_area", "label": "Land Area", "type": "number"},
        {"key": "land_ownership_type", "label": "Land Ownership Type", "type": "enum", "options": ["Owned", "Lease", "JV"]},
        {"key": "zoning_classification", "label": "Zoning Classification", "type": "string"}
      ]
    },
    {
      "group": "Schedule Controls",
      "fields": [
        {"key": "planned_start_date", "label": "Planned Start Date", "type": "date"},
        {"key": "planned_end_date", "label": "Planned End Date", "type": "date"},
        {"key": "actual_start_date", "label": "Actual Start Date", "type": "date"},
        {"key": "actual_end_date", "label": "Actual End Date", "type": "date"},
        {"key": "project_calendar", "label": "Project Calendar", "type": "string"},
        {"key": "shift_pattern", "label": "Shift Pattern", "type": "enum", "options": ["Single", "Double", "Triple"]},
        {"key": "milestone_strategy", "label": "Milestone Strategy", "type": "string"}
      ]
    },
    {
      "group": "Financial & Commercial",
      "fields": [
        {"key": "currency", "label": "Currency", "type": "string"},
        {"key": "estimated_project_cost", "label": "Estimated Project Cost", "type": "number"},
        {"key": "approved_budget", "label": "Approved Budget", "type": "number"},
        {"key": "funding_type", "label": "Funding Type", "type": "enum", "options": ["Self", "Bank", "JV"]},
        {"key": "revenue_model", "label": "Revenue Model", "type": "enum", "options": ["Sale", "Lease", "BOT"]},
        {"key": "tax_structure", "label": "Tax Structure", "type": "string"},
        {"key": "escalation_clause", "label": "Escalation Clause", "type": "boolean"}
      ]
    },
    {
      "group": "Construction & Technical",
      "fields": [
        {"key": "construction_technology", "label": "Construction Technology", "type": "enum", "options": ["Conventional", "Precast", "Hybrid"]},
        {"key": "structural_system", "label": "Structural System", "type": "string"},
        {"key": "number_of_buildings", "label": "Number of Buildings", "type": "number"},
        {"key": "typical_floor_count", "label": "Typical Floor Count", "type": "number"},
        {"key": "total_builtup_area", "label": "Total Built-up Area", "type": "number"},
        {"key": "unit_mix", "label": "Unit Mix", "type": "string"},
        {"key": "height_restriction", "label": "Height Restriction", "type": "number"},
        {"key": "seismic_zone", "label": "Seismic Zone", "type": "string"}
      ]
    },
    {
      "group": "Audit & Lifecycle",
      "fields": [
        {"key": "lifecycle_stage", "label": "Project Lifecycle Stage", "type": "enum", "options": ["Concept", "Design", "Execution", "Handover", "Closeout"]},
        {"key": "created_by", "label": "Created By", "type": "user"},
        {"key": "created_on", "label": "Created On", "type": "datetime"},
        {"key": "last_updated_by", "label": "Last Updated By", "type": "user"},
        {"key": "last_updated_on", "label": "Last Updated On", "type": "datetime"},
        {"key": "change_reason", "label": "Change Reason", "type": "text"}
      ]
    }
  ]
}


