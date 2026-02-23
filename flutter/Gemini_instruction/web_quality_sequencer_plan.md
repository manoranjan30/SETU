# Web Module Development Plan: Quality Activity Sequencer (Networked Drag & Drop)

> **Context:** This document outlines the implementation plan for the **Quality Activity Sequencer** in the web-based Admin Panel. The goal is to replace simple linear lists with a powerful **Node-Based Visual Editor** (Flowchart) that allows admins to define complex dependencies, parallel workflows, and constraint types (Breakable vs. Unbreakable) for quality inspections.

---

## 1. System Overview

### **Target Platform**
- **Web Only (Desktop/Laptop):**
  - **Screen Real Estate:** High (1920x1080+ typical).
  - **Interaction:** Mouse & Keyboard (Precise Drag & Drop).
  - **Framework:** React (Vite) + Tailwind CSS.
- **Mobile Consideration:** **NONE.** Viewing/Execution on mobile will be a simplified checklist, but definition happens strictly on Web.

### **Core Requirement: "Networked Drag & Drop"**
- **Nodes:** Activities (e.g., "Molding Check", "Reinforcement Check").
- **Edges (Connections):** Dependencies between activities.
- **Properties:**
  - **Direction:** Unidirectional (A -> B).
  - **Type:**
    - 🔴 **Unbreakable (Hard):** Successor is LOCKED/DISABLED until predecessor passes.
    - 🟡 **Breakable (Soft):** Successor shows WARNING but allows bypass (requires "Force Reason").

---

## 2. Tech Stack Recommendation

### **Library: React Flow (or XYFlow)**
- **Why?** Industry standard for React-based node editors.
- **Features:**
  - Built-in Drag & Drop.
  - Minimap, Controls (Zoom/Pan).
  - Custom Node Types (we need this for "Activity Cards").
  - Edge Types (Bezier, Step, Straight).
  - Event Handling (onConnect, onNodeDrag).

---

## 3. Implementation Plan

### **Phase 1: Backend Data Model (NestJS)**

We need to store the *Graph* structure, not just a list.

#### **Entity: `QualityActivitySequence`**
Instead of a simple `sequence_order` integer, we need an adjacency list or edge table.

```typescript
// New Entity: quality-sequence-edge.entity.ts
@Entity()
class QualitySequenceEdge {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => QualityActivity)
  source: QualityActivity; // The "Predecessor"

  @ManyToOne(() => QualityActivity)
  target: QualityActivity; // The "Successor"

  @Column({ type: 'enum', enum: ['HARD', 'SOFT'], default: 'HARD' })
  constraintType: 'HARD' | 'SOFT'; // Unbreakable vs Breakable

  @Column({ nullable: true })
  lagMinutes: number; // Optional delay (e.g., curing time)
}
```

#### **API Endpoints**
- `GET /quality/sequences/:templateId`: Returns nodes and edges.
- `POST /quality/sequences`: Batch updates the graph (nodes positions + edges).

---

### **Phase 2: Frontend Editor (React)**

#### **A. The Canvas (The "Board")**
- **Layout:**
  - **Sidebar (Left):** "Toolbox" containing available Quality Activities (draggables).
  - **Main Area:** Infinite Canvas (`<ReactFlow />`).
  - **Properties Panel (Right/Floating):** Context-sensitive settings when a Node or Edge is selected.

#### **B. Custom Node Component**
- **Design:** A sleek card.
  - **Header:** Activity Name.
  - **Body:** Brief description or checklist count.
  - **Ports (Handles):**
    - **Input (Left/Top):** Connect predecessors here.
    - **Output (Right/Bottom):** Connect successors here.

#### **C. Edge Logic (The "Links")**
- **Default:** Creating a connection makes a **Solid Red Line (Unbreakable)**.
- **Interaction:** Clicking an edge opens a small popover:
  - Toggle Switch: "Allow Bypass?" (Changes line to **Dashed Yellow**).
  - Input: "Lag Time (hours)".

### **Phase 3: Integration & Validation**

#### **A. Cycle Detection**
- **Critical:** Prevent infinite loops (A -> B -> A). `ReactFlow` has helper functions/hooks for this (`isDAG`).
- **Validation:** On `save()`, run a topological sort check. If cycle exists -> Error "Invalid Loop Detected".

#### **B. Layouting**
- **Auto-Layout Button:** Use `dagre` or `elkjs` to automatically arrange nodes in a clean hierarchy (Tree layout) if the manual drag-drop gets messy.

---

## 4. Execution Roadmap for AI Agent

### **Step 1: Backend Setup**
1.  Create `QualitySequenceEdge` entity.
2.  Update `QualityActivity` entity (One activity can have many sources/targets).
3.  Create Service methods: `saveSequenceGraph`, `getSequenceGraph`.
4.  Expose API endpoints.

### **Step 2: Frontend Setup**
1.  Install `reactflow` packages.
2.  Create `QualitySequencer` page route.
3.  Implement `Sidebar` (Source of new nodes).
4.  Implement `Canvas` (Drop target).

### **Step 3: Graph Logic**
1.  Create `CustomActivityNode.tsx`.
2.  Implement `onConnect` logic (prevent duplicate edges).
3.  Implement `onEdgeClick` popover (Constraint toggling).

### **Step 4: Persistence**
1.  Implement **Save Button**:
    - Serializes `nodes` (id, position x/y).
    - Serializes `edges` (source, target, type).
    - Sends JSON payload to Backend. (PUT /quality/sequences).

---

## 5. User Workflow (Admin)

1.  **Open Template:** Admin opens "Foundation Inspection Workflow".
2.  **Drag:** Drags "Excavation Check" from sidebar to canvas.
3.  **Drag:** Drags "PCC Pour" to canvas.
4.  **Connect:** Draws line from "Excavation" -> "PCC".
5.  **Configure:** Clicks line. Sets as "Unbreakable" (Must pass Excavation to start PCC).
6.  **Save:** Clicks "Save Workflow". Backend validates and stores.
 