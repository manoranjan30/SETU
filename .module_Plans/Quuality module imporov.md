Objective

Build a fully integrated Quality Management Module tightly linked with:

EPS Structure (Project → Block → Tower → Floor)

Units & Rooms (inside Quality module)

Schedule Activities

Project Team Roles

Multi-stage Inspections

Observations & Compliance

Digital Signature & Document Locking

2️⃣ System Architecture Overview
Frontend (React)
    ↓
API Layer (NestJS)
    ↓
Service Layer
    ↓
PostgreSQL Database
    ↓
File Storage (S3 / Blob / Local)

Architecture Style: Modular Monolith (Future Microservice-ready)

3️⃣ Complete Functional Flow
📌 Inspection Creation Flow
Open App
  → Select Project
      → Select Block
          → Select Tower
              → Select Floor
                  → Select Unit (Optional)
                      → Select Room (Optional)
                          → Select Activity
                              → Create Inspection Request

Notification is automatically sent to assigned inspector.

4️⃣ 📐 UI Wireframe – Screen by Screen
4.1 Quality Dashboard
Screen: Quality Overview
-------------------------------------------------
| Project Selector                             |
-------------------------------------------------
| Pending Inspections | Open Observations      |
| Delayed Closures    | Quality Score %        |
-------------------------------------------------
| Floor-wise Status Heat Map                   |
-------------------------------------------------
| Recent Activities List                       |
-------------------------------------------------
4.2 Quality Activity Master
-------------------------------------------------
| Activity Name                                |
| Linked Schedule Activity (Dropdown)          |
| Location Type (Floor / Unit / Room)          |
| Checklist Template                           |
| Required Stages (Pre/During/Post)            |
| Save                                         |
-------------------------------------------------
4.3 Checklist Template Builder
-------------------------------------------------
| Template Name                                |
-------------------------------------------------
| + Add Item                                   |
|-----------------------------------------------|
| Item | Type | Mandatory | Photo Req | Delete |
-------------------------------------------------
| Save Version                                 |
-------------------------------------------------

Item Types:

Yes/No

Text

Numeric

Dropdown

Photo Required

4.4 Create Inspection Screen
-------------------------------------------------
Project: [Dropdown]
Block: [Dropdown]
Tower: [Dropdown]
Floor: [Dropdown]
Unit: [Optional]
Room: [Optional]
-------------------------------------------------
Activity: [Filtered Dropdown]
-------------------------------------------------
[Create Inspection]
-------------------------------------------------
4.5 Inspector View – Stage Execution
-------------------------------------------------
Inspection ID
Location Details
Activity Name
-------------------------------------------------
Stage: Pre Work
-------------------------------------------------
Checklist Items:
[ ] Item 1  (Yes/No)
[ ] Item 2  (Photo Upload)
[ ] Item 3  (Numeric)
-------------------------------------------------
Add Observation
Close Stage
-------------------------------------------------
4.6 Observation Screen
-------------------------------------------------
Observation Description
Severity: Minor/Major/Critical
Photo Upload
Due Date
-------------------------------------------------
[Save]
-------------------------------------------------
4.7 Signature Capture Screen
-------------------------------------------------
Draw Signature Pad
-------------------------------------------------
Confirm & Lock Stage
-------------------------------------------------

After locking:

Checklist becomes read-only

PDF generated

Hash stored

5️⃣ 🔌 API Endpoint Design
5.1 Quality Activity
POST   /quality/activity
GET    /quality/activity/:projectId
PUT    /quality/activity/:id
DELETE /quality/activity/:id
5.2 Checklist Template
POST   /quality/checklist-template
GET    /quality/checklist-template/:projectId
POST   /quality/checklist-template/:id/copy
PUT    /quality/checklist-template/:id
5.3 Inspection
POST   /quality/inspection
GET    /quality/inspection/:projectId
GET    /quality/inspection/details/:id
PUT    /quality/inspection/:id/assign
PUT    /quality/inspection/:id/close-stage
PUT    /quality/inspection/:id/final-close
5.4 Observations
POST   /quality/observation
PUT    /quality/observation/:id/rectify
PUT    /quality/observation/:id/verify
GET    /quality/observation/:inspectionId
5.5 Signature & Compliance
POST   /quality/signature/:stageId
GET    /quality/document/:inspectionId
5.6 Dashboard APIs
GET /quality/dashboard/:projectId
GET /quality/analytics/floor/:projectId
GET /quality/analytics/contractor/:projectId
6️⃣ 🧱 NestJS Module Folder Structure
src/
 └── modules/
      └── quality/
           ├── controllers/
           │     quality.controller.ts
           │     checklist.controller.ts
           │     inspection.controller.ts
           │     observation.controller.ts
           │
           ├── services/
           │     quality.service.ts
           │     checklist.service.ts
           │     inspection.service.ts
           │     observation.service.ts
           │     compliance.service.ts
           │
           ├── entities/
           │     quality-activity.entity.ts
           │     checklist-template.entity.ts
           │     checklist-item.entity.ts
           │     inspection.entity.ts
           │     stage-log.entity.ts
           │     observation.entity.ts
           │     signature.entity.ts
           │
           ├── dto/
           ├── enums/
           ├── guards/
           ├── utils/
           └── quality.module.ts
7️⃣ 📊 Quality Analytics Formula Logic
7.1 Quality Score %
Quality Score % =
(Total Passed Checklist Items / Total Checklist Items) × 100
7.2 Observation Density
Observation Density =
Total Observations / Total Inspections
7.3 Critical Issue Ratio
Critical Issue % =
(Critical Observations / Total Observations) × 100
7.4 Contractor Quality Index
CQI =
(100 - Observation Density × Weight) 
- (Critical Issue % × 2)
7.5 Floor Heatmap Status

Color logic:

Green → All inspections closed

Yellow → Pending inspection

Red → Critical observation open

8️⃣ 🔐 Advanced Compliance Architecture
8.1 Digital Locking Strategy

When stage closes:

Serialize checklist data

Add:

Timestamp

User ID

Location

Generate SHA-256 hash

Store hash in database

If any data changes → Hash mismatch → Tamper detected

8.2 Signature Options
Level 1 – Basic

Draw signature

Store image

Timestamp

Level 2 – Hash Lock (Recommended)

Generate hash

Freeze record

Make immutable

Level 3 – Government-Grade

Integrate DSC

Aadhaar eSign

PKI-based signing

8.3 Audit Trail Table

Every action logged:

audit_logs
---------------------------------
id
entity_type
entity_id
action
performed_by
timestamp
old_value
new_value
ip_address
8.4 Document Generation

Generated on:

Stage close

Final inspection close

PDF Includes:

Project

EPS Path

Unit/Room

Schedule Activity ID

Inspector Signature

QR Code

Hash Code

9️⃣ EPS + QUALITY HIERARCHY
Project
 └── Block
      └── Tower
           └── Floor
                └── Unit
                     └── Room
                           └── Schedule Activity
                                 └── Quality Activity
                                       └── Inspection
                                            └── Stage
                                                 └── Checklist
                                                      └── Observation
                                                           └── Signature
🔟 Final System Capabilities

✔ Schedule-linked inspection
✔ Location-based quality control
✔ Role-driven workflow
✔ Multi-stage inspections
✔ Observation lifecycle
✔ Digital compliance
✔ Analytics dashboard
✔ Document locking

🚀 This Is Now Enterprise-Grade

You are building:

A fully integrated Construction Quality ERP aligned with EPS, Planning, and Compliance.