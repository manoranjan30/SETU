import React, { useMemo, useRef, useState, type CSSProperties } from "react";
// @ts-ignore
import { List } from "react-window/dist/react-window.js";
import { AutoSizer } from "react-virtualized-auto-sizer";
import clsx from "clsx";
import { ZoomIn, ZoomOut } from "lucide-react";

interface GanttChartProps {
  data: any[];
  zoom: number; // This can now be ViewMode factor? Or we manage internal state?
  // User requested: "Semantic Zoom"
}

type ViewMode = "Day" | "Week" | "Month" | "Quarter";

const GanttChart: React.FC<GanttChartProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<ViewMode>("Week");

  // 1. Prepare Data
  const activities = useMemo(
    () =>
      data.filter((a) => {
        const start = a.schedule?.earlyStart || a.startDatePlanned;
        const finish = a.schedule?.earlyFinish || a.finishDatePlanned;
        return start && finish;
      }),
    [data],
  );

  // 2. Calculate Timeline
  const timeline = useMemo(() => {
    if (activities.length === 0) return null;

    let minTime = Number.MAX_SAFE_INTEGER;
    let maxTime = Number.MIN_SAFE_INTEGER;

    activities.forEach((a) => {
      const start = new Date(
        a.schedule?.earlyStart || a.startDatePlanned,
      ).getTime();
      const finish = new Date(
        a.schedule?.earlyFinish || a.finishDatePlanned,
      ).getTime();
      if (start < minTime) minTime = start;
      if (finish > maxTime) maxTime = finish;
    });

    const start = new Date(minTime);
    const end = new Date(maxTime);

    // Add Buffer
    start.setDate(start.getDate() - 15);
    end.setDate(end.getDate() + 45);

    // Grid Generation
    let subHeaders: { label: string; width: number }[] = [];
    let cellWidth = 0;
    let totalWidth = 0;

    if (viewMode === "Day") {
      cellWidth = 30;
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 3600 * 24),
      );

      // SubHeaders: Days
      const startCopy = new Date(start);
      for (let i = 0; i < days; i++) {
        subHeaders.push({
          label: String(startCopy.getDate()),
          width: cellWidth,
        });
        startCopy.setDate(startCopy.getDate() + 1);
      }

      // Headers: Months
      // (Simplified: Just grouping days logic, omitted for brevity, keeping simple single header for Day mode for now or duplicate logic)
    } else if (viewMode === "Week") {
      cellWidth = 40; // Pixel width for 1 week? No, too small.
      // If 1 week is a column.

      // Align start to Monday
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff); // Monday

      const weeks = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 3600 * 24 * 7),
      );

      const startCopy = new Date(start);
      for (let i = 0; i < weeks; i++) {
        subHeaders.push({
          label: `${startCopy.getDate()}/${startCopy.getMonth() + 1}`,
          width: cellWidth,
        });
        startCopy.setDate(startCopy.getDate() + 7);
      }
    } else if (viewMode === "Month") {
      cellWidth = 60;
      start.setDate(1); // 1st of month

      // Align end
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);

      let curr = new Date(start);
      while (curr < end) {
        subHeaders.push({
          label: curr.toLocaleDateString("default", {
            month: "short",
            year: "2-digit",
          }),
          width: cellWidth,
        });
        curr.setMonth(curr.getMonth() + 1);
      }
    } else if (viewMode === "Quarter") {
      cellWidth = 80;
      start.setDate(1);
      start.setMonth(Math.floor(start.getMonth() / 3) * 3); // Start of Quarter

      let curr = new Date(start);
      while (curr < end) {
        const q = Math.floor(curr.getMonth() / 3) + 1;
        subHeaders.push({
          label: `Q${q} '${curr.getFullYear().toString().slice(2)}`,
          width: cellWidth,
        });
        curr.setMonth(curr.getMonth() + 3);
      }
    }

    totalWidth = subHeaders.length * cellWidth;

    return { start, end, cellWidth, totalWidth, subHeaders };
  }, [activities, viewMode]);

  if (!timeline) {
    return (
      <div className="p-10 text-center text-text-muted">
        No scheduled activities to display. Import schedule or run CPM.
      </div>
    );
  }

  const { start: timelineStart, cellWidth, totalWidth, subHeaders } = timeline;

  const getPosition = (dateStr: string) => {
    const d = new Date(dateStr).getTime();
    const s = timelineStart.getTime();
    const msPerPixel =
      (viewMode === "Day"
        ? 1000 * 3600 * 24
        : viewMode === "Week"
          ? 1000 * 3600 * 24 * 7
          : viewMode === "Month"
            ? 1000 * 3600 * 24 * 30 // approx
            : 1000 * 3600 * 24 * 90) / // approx
      cellWidth;

    // More precise diff for months/quarters?
    // For 'Month', uniform width assumes uniform month length.
    // Let's use simplified linear interpolation for now.

    return (d - s) / msPerPixel;
  };

  const rowHeight = 40;
  const headerHeight = 50;
  const sidebarWidth = 300; // Increased

  const headerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<any>(null);

  // Native Scroll Listener for Header Sync (Gantt)
  React.useEffect(() => {
    const listElement = listRef.current?.element;
    if (!listElement) return;

    const handleScroll = () => {
      if (headerRef.current) {
        headerRef.current.scrollLeft = listElement.scrollLeft;
      }
    };

    listElement.addEventListener("scroll", handleScroll);
    return () => listElement.removeEventListener("scroll", handleScroll);
  }, [listRef.current]);

  // Zoom Controls
  const zoomIn = () => {
    if (viewMode === "Quarter") setViewMode("Month");
    else if (viewMode === "Month") setViewMode("Week");
    else if (viewMode === "Week") setViewMode("Day");
  };
  const zoomOut = () => {
    if (viewMode === "Day") setViewMode("Week");
    else if (viewMode === "Week") setViewMode("Month");
    else if (viewMode === "Month") setViewMode("Quarter");
  };

  const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
    const act = activities[index];
    const rawStart = act.schedule?.earlyStart || act.startDatePlanned;
    const rawFinish = act.schedule?.earlyFinish || act.finishDatePlanned;

    const left = getPosition(rawStart);
    const finishPos = getPosition(rawFinish);
    const width = Math.max(finishPos - left, 4); // Min width

    const isCritical = act.schedule?.isCritical || false;

    const combinedName = act.wbsNode
      ? `${act.wbsNode.name} - ${act.activityName}`
      : act.activityName;

    return (
      <div
        style={style}
        className="flex border-b border-border-subtle bg-surface-card hover:bg-surface-base group"
      >
        {/* Sticky Sidebar */}
        <div
          className="sticky left-0 z-10 bg-surface-card border-r border-border-default flex items-center px-4 text-sm truncate shrink-0 group-hover:bg-surface-base"
          style={{ width: sidebarWidth, height: "100%" }}
          title={combinedName}
        >
          <span className="font-mono text-xs text-text-muted mr-2 shrink-0">
            {act.activityCode}
          </span>
          <span className="truncate">{combinedName}</span>
        </div>

        {/* Timeline */}
        <div
          className="relative flex-1 h-full"
          style={{ minWidth: totalWidth }}
        >
          {/* Horizontal Grid Lines (Optional) */}

          {/* Bar */}
          <div
            className={clsx(
              "absolute top-2.5 h-5 rounded-sm text-[10px] flex items-center px-1 text-white overflow-hidden whitespace-nowrap shadow-sm transition-all",
              isCritical ? "bg-error" : "bg-primary opacity-80",
            )}
            style={{ left, width }}
            title={`${combinedName}: ${new Date(rawStart).toLocaleDateString()} - ${new Date(rawFinish).toLocaleDateString()}`}
          >
            {width > 50 && act.activityName}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 h-full w-full overflow-hidden bg-surface-card flex flex-col border border-border-default min-h-0">
      {/* Toolbar */}
      <div className="h-10 bg-surface-card border-b border-border-default flex items-center px-4 justify-between shrink-0">
        <span className="font-semibold text-text-secondary">
          Gantt View: {viewMode}
        </span>
        <div className="flex space-x-2">
          <button
            onClick={zoomOut}
            className="p-1 hover:bg-surface-raised rounded border border-border-default"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-text-secondary" />
          </button>
          <button
            onClick={zoomIn}
            className="p-1 hover:bg-surface-raised rounded border border-border-default"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-text-secondary" />
          </button>
        </div>
      </div>

      {/* Header */}
      <div
        ref={headerRef}
        className="flex border-b border-border-default bg-surface-base overflow-hidden shrink-0"
        style={{ height: headerHeight }}
      >
        <div
          className="sticky left-0 z-20 bg-surface-base border-r border-border-default flex items-center px-4 font-semibold text-xs text-text-muted shrink-0"
          style={{ width: sidebarWidth }}
        >
          Activity
        </div>
        <div className="flex" style={{ width: totalWidth }}>
          {subHeaders.map((h, i) => (
            <div
              key={i}
              className="flex-shrink-0 border-r border-border-default flex flex-col items-center justify-center text-[10px] text-text-muted font-medium"
              style={{ width: h.width }}
            >
              {h.label}
            </div>
          ))}
        </div>
      </div>

      {/* Virtualized Body */}
      <div className="flex-1 w-full relative min-h-0">
        {/* @ts-ignore */}
        <AutoSizer
          renderProp={({
            height = 0,
            width = 0,
          }: {
            height?: number;
            width?: number;
          }) => (
            // @ts-ignore
            <List
              rowCount={activities.length}
              rowHeight={rowHeight}
              listRef={listRef}
              style={{ height, width, overflow: "auto" }}
              rowProps={{} as any}
              rowComponent={({
                index,
                style,
              }: {
                index: number;
                style: CSSProperties;
              }) => (
                <div style={{ ...style, minWidth: sidebarWidth + totalWidth }}>
                  <Row
                    index={index}
                    style={{ ...style, width: sidebarWidth + totalWidth }}
                  />
                </div>
              )}
            />
          )}
        />
      </div>
    </div>
  );
};

export default GanttChart;
