# Schedule Management Features

This document details the features and behaviors implemented in the Project Schedule module (`ScheduleTable.tsx` and related components).

## 1. Schedule Table Visualization
The schedule is rendered as a virtualized table (using `react-window`) to support large datasets efficiently.

### Key Features
*   **Virtualization**: Renders only the visible rows to maintain high performance with thousands of activities.
*   **Synced Header**: The column header scrolls horizontally in perfect sync with the table body.
    *   *Implementation*: Uses `onScrollCapture` to intercept scroll events and applies a "Scrollbar Buffer" to ensure alignment even with vertical scrollbars.
*   **Sticky Columns**:
    *   **Activity ID** and **Activity Name** are frozen (sticky) to the left, ensuring context is never lost while scrolling right.
*   **WBS Tree Structure**:
    *   Rows are hierarchical (WBS Nodes -> Activities).
    *   **Expand/Collapse**: Users can toggle WBS branches.

## 2. Editable Columns & Data Entry

### Percentage Status
*   **Editable**: Users can click and type directly into the `%` cell.
*   **Component**: Uses `EditableNumberCell` to allow free typing without focus loss.
*   **Auto-Date Logic**:
    *   **Start**: Entering any value > 0% (for the first time) automatically sets the **Actual Start Date** to Today.
    *   **Finish**: Entering 100% automatically sets the **Actual Finish Date** to Today.
    *   **Revert**: Changing from 100% back to <100% clears the Actual Finish Date.

### Dates (Actual Start / Finish)
*   **Editable**: Uses a date picker (browser native or custom) to select dates.
*   **Validation**: Ensures logical data availability.

## 3. WBS Summary Rows
Summary (WBS) rows display aggregated or rolled-up data.

*   **Read-Only**: Data on these rows is calculated from children and cannot be edited directly.
*   **Visible Columns**:
    *   **Actual Start / Finish**: Displays the earliest Start and latest Finish of child activities.
    *   **Baseline Start / Finish**: Displays the baseline range.
    *   **Variance**: Calculates the difference between Planned Finish and Actual/Early Finish.
        *   **Green**: On time or ahead (<= 0 days).
        *   **Red**: Delayed (> 0 days).

## 4. Technical Reference
*   **Container**: `src/pages/SchedulePage.tsx` - Handles fetching and state updates.
    *   *Note*: Uses functional state updates to prevent stale closure bugs during rapid edits.
*   **Component**: `src/components/schedule/ScheduleTable.tsx` - Main grid logic.
*   **Styling**: Tailwind CSS.
