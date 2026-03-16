# Task: Management Dashboard Integration (Progress, Quality, EHS)

## Objective
Revamp the `ManagementDashboard.tsx` to serve as a comprehensive executive control center, combining key metrics from the **Progress Monitoring**, **Quality**, and **EHS** modules into a single, highly readable page.

## 1. Architectural & Layout Strategy (The "Three Pillars" One-Screen Layout)
Instead of horizontal rows that cause vertical scrolling, the dashboard will use a **Three Vertical Pillars** design. The entire dashboard will be strictly constrained to `100vh` (minus the top navbar), meaning absolutely **zero scrolling**. 

We will achieve extreme data density with a premium, modern, and colorful aesthetic using CSS Grid (`grid-cols-1 lg:grid-cols-3 h-[calc(100vh-80px)] overflow-hidden`).

### A. Pillar 1: Progress & Execution (The "Blue/Slate" Column)
- **Top Ribbon**: Active Projects & Overall Financial Burn.
- **Burn Rate Mini-Chart**: A highly compact area chart showing the financial trajectory.
- **Manpower Widget**: A tight, multi-colored progress bar or donut chart of today's workforce.
- **Critical Milestones**: 3-4 overdue or upcoming tasks displayed as tight, colorful badges.

### B. Pillar 2: Quality Control (The "Indigo/Amber" Column)
- **Top Ribbon**: Critical NCRs count.
- **Inspection Status**: A dense 3-block grid (Open, Closed, Pending QA) with large, bold numbers.
- **NCR Aging Profile**: A compact Donut chart (`< 7 Days`, `7-14 Days`, `> 14 Days`) with a modern glassmorphism legend.
- **Quality Alerts**: 2-3 most critical open observations listed in a minimalist, icon-heavy format.

### C. Pillar 3: EHS - Environment, Health & Safety (The "Emerald/Rose" Column)
- **Top Ribbon**: Safe Man-Hours.
- **Incident Tracker**: A visually striking horizontal row of 3 cards (LTI, Medical, Near Misses).
- **Compliance Gauge**: A modern SVG semi-circle gauge chart showing the PTW/Walkdown compliance %.
- **Quick Action**: A premium, gradient-style "Report Hazard" button anchored at the bottom of the column.

## 2. API & Backend Requirements
(Completed in Phase 3 & 4 previously, APIs are live and active)
1. `GET /dashboard/summary`: High-level Progress data.
2. `GET /dashboard/quality-metrics`: Live quality metrics & NCR aging.
3. `GET /dashboard/ehs-metrics`: Live EHS incident breakdown and safe man-hours.

## 3. Implementation Phasing

### Phase 5: "No-Scroll" UI Overhaul (Current Phase)
1. **Structural Redesign**: Wipe the current horizontal layout in `ManagementDashboard.tsx`.
2. **Implement 3-Column Grid**: Set up the `h-full` 3-column grid structure.
3. **Data Density Refinement**: Re-code the Recharts and StatCards to be extremely compact, removing all excess padding and margins.
4. **Color & Premium Feel**: Add subtle gradients, glassmorphism (`backdrop-blur`), and vibrant branding colors specific to each pillar to make it look like a state-of-the-art control room.
5. **Hide Scrolling**: Apply `overflow-hidden` globally to the dashboard container and use `overflow-y-auto` *only* inside the specific milestone/alert lists if absolutely necessary (though the goal is 100% no scroll).

## 4. UI/UX Principles
- **Absolute Constraints**: The page must mathematically fit horizontally and vertically. `calc(100vh - headerHeight)`.
- **Micro-Visualizations**: We will use sparklines and tight donut charts instead of large, screen-hogging Cartesian charts.
- **Distinct Identities**:
  - *Progress*: Clean corporate Blue/Slate.
  - *Quality*: Trustworthy Indigo with Amber alerts (keeping the No Purple rule).
  - *EHS*: Calming Emerald green with stark Rose for hazards.

---
**Status:** READY FOR PHASE 5. Awaiting User Approval to execute the exact 3-Pillar UI.
