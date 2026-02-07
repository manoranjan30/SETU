# Execution Context Architecture

This document defines the core architecture for linking Planning (Activities) with Reality (Quantities/BOQ) using the **Execution Context** pattern.

## 🧱 Core Concept
Traditional project management separates scheduling (Time) from estimation (Quantity).
We unify them using a binding layer.

**The Golden Rule**:
*   **Activities** define *Time & Sequence* (Planning).
*   **BOQ** defines *Scope & Quantity* (Budget).
*   **EPS** defines *Location* (Where).
*   **Execution Context** binds them all and tracks *Progress*.

## 🏗 Data Model

### 1. BOQ Element (The Scope)
The authoritative source of "How much work exists".
*   **Location**: Always tied to an EPS Node (e.g., "Tower A").
*   **Attributes**: Code, Description, UOM, Total Quantity.
*   **Behavior**:
    *   Quantities never live in Activities.
    *   Quantities define the budget.

### 2. Activity (The Plan)
The authoritative source of "When and How".
*   **Location**: Tied to WBS (Planning hierarchy).
*   **Attributes**: Duration, Dates, Dependencies (CPM).
*   **Behavior**:
    *   Does not "own" quantity.
    *   Receives progress updates from linked Execution Contexts.

### 3. Execution Context (The Bridge)
The transactional layer where work happens.
*   **Definition**: "Doing *this portion* of **BOQ X** using **Activity Y** at **Location Z**".
*   **Attributes**:
    *   `epsNodeId`: Granular location (e.g., Floor 5).
    *   `boqElementId`: What are we installing? (e.g., Concrete).
    *   `activityId`: Which schedule task covers this? (e.g., Pouring).
    *   `plannedQuantity`: Allocation for this specific context.
    *   `actualQuantity`: Progress log.
*   **Behavior**:
    *   Progress entry happens ONLY here.
    *   Updates roll UP to BOQ (Budget vs Actual).
    *   Updates roll UP to Activity (Schedule Progress).

## 🔄 Logic Flow

### Progress Update
1.  User enters `actualQuantity` in an `ExecutionContext`.
2.  System recalculates `percentComplete` for that context.
    *   `percent = actual / planned * 100`

### Rollup: BOQ
*   `BoqElement.consumedQuantity = SUM(All Contexts.actualQuantity)`

### Rollup: Activity
*   `Activity.percentComplete = AVG(Contexts.percentComplete)` (Weighted by quantity typically).
*   `Activity.actualStart` = Min(Contexts.actualStart)
*   `Activity.actualFinish` = When ALL contexts are 100%.

## 🛡 Rules
1.  **Quantities never live in Activities**: Prevents schedule corruption.
2.  **EPS never stores progress**: It only defines location.
3.  **One BOQ -> Many Activities**: Allowed (e.g., "Concrete" used in "Footings" and "Slabs").
4.  **One Activity -> Many BOQs**: Allowed (e.g., "Wall" uses "Brick" and "Sand").
