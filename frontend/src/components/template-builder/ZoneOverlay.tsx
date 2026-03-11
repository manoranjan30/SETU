import { useRef, useState, useCallback } from "react";
import type {
  TemplateZone,
  ZoneBounds,
  ZoneType,
} from "../../types/template.types";

interface ZoneOverlayProps {
  zones: TemplateZone[];
  onZonesChange: (zones: TemplateZone[]) => void;
  selectedZoneId: string | null;
  onSelectZone: (id: string | null) => void;
  isDrawing: boolean;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  onZoneDrawn?: (zone: TemplateZone, bounds: ZoneBounds) => void;
}

type InteractionMode = "none" | "drawing" | "resizing" | "dragging";
type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const HANDLE_SIZE = 10;
const MIN_ZONE_SIZE = 20;

const ZoneOverlay = ({
  zones,
  onZonesChange,
  selectedZoneId,
  onSelectZone,
  isDrawing,
  pageWidth,
  pageHeight,
  scale,
  onZoneDrawn,
}: ZoneOverlayProps) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Interaction state
  const [mode, setMode] = useState<InteractionMode>("none");
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [currentBounds, setCurrentBounds] = useState<ZoneBounds | null>(null);

  // Resize state
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    mouse: { x: number; y: number };
    bounds: ZoneBounds;
  } | null>(null);

  // Drag state
  const [dragStart, setDragStart] = useState<{
    mouse: { x: number; y: number };
    bounds: ZoneBounds;
  } | null>(null);

  // Get mouse position relative to SVG, accounting for scale
  const getMousePosition = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      return {
        x: Math.max(0, Math.min(pageWidth, x)),
        y: Math.max(0, Math.min(pageHeight, y)),
      };
    },
    [pageWidth, pageHeight, scale],
  );

  // Start drawing a new zone
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start drawing if in drawing mode and not clicking on an existing element
      if (!isDrawing || mode !== "none") return;

      const target = e.target as SVGElement;
      if (target.dataset.zoneid || target.dataset.handle) return;

      e.preventDefault();
      e.stopPropagation();

      const pos = getMousePosition(e);
      setMode("drawing");
      setDrawStart(pos);
      setCurrentBounds({ x: pos.x, y: pos.y, w: 0, h: 0 });
      onSelectZone(null);
    },
    [isDrawing, mode, getMousePosition, onSelectZone],
  );

  // Handle all mouse movement
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePosition(e);

      // Drawing new zone
      if (mode === "drawing" && drawStart) {
        setCurrentBounds({
          x: Math.min(drawStart.x, pos.x),
          y: Math.min(drawStart.y, pos.y),
          w: Math.abs(pos.x - drawStart.x),
          h: Math.abs(pos.y - drawStart.y),
        });
        return;
      }

      // Resizing existing zone
      if (
        mode === "resizing" &&
        resizeStart &&
        activeHandle &&
        selectedZoneId
      ) {
        const dx = pos.x - resizeStart.mouse.x;
        const dy = pos.y - resizeStart.mouse.y;
        const { bounds } = resizeStart;

        let newBounds = { ...bounds };

        switch (activeHandle) {
          case "nw":
            newBounds = {
              x: bounds.x + dx,
              y: bounds.y + dy,
              w: bounds.w - dx,
              h: bounds.h - dy,
            };
            break;
          case "n":
            newBounds = { ...bounds, y: bounds.y + dy, h: bounds.h - dy };
            break;
          case "ne":
            newBounds = {
              ...bounds,
              y: bounds.y + dy,
              w: bounds.w + dx,
              h: bounds.h - dy,
            };
            break;
          case "e":
            newBounds = { ...bounds, w: bounds.w + dx };
            break;
          case "se":
            newBounds = { ...bounds, w: bounds.w + dx, h: bounds.h + dy };
            break;
          case "s":
            newBounds = { ...bounds, h: bounds.h + dy };
            break;
          case "sw":
            newBounds = {
              x: bounds.x + dx,
              y: bounds.y,
              w: bounds.w - dx,
              h: bounds.h + dy,
            };
            break;
          case "w":
            newBounds = {
              x: bounds.x + dx,
              y: bounds.y,
              w: bounds.w - dx,
              h: bounds.h,
            };
            break;
        }

        // Enforce minimum size and positive values
        if (
          newBounds.w >= MIN_ZONE_SIZE &&
          newBounds.h >= MIN_ZONE_SIZE &&
          newBounds.x >= 0 &&
          newBounds.y >= 0
        ) {
          onZonesChange(
            zones.map((z) =>
              z.id === selectedZoneId ? { ...z, bounds: newBounds } : z,
            ),
          );
        }
        return;
      }

      // Dragging zone
      if (mode === "dragging" && dragStart && selectedZoneId) {
        const dx = pos.x - dragStart.mouse.x;
        const dy = pos.y - dragStart.mouse.y;
        const { bounds } = dragStart;

        const newX = Math.max(0, Math.min(pageWidth - bounds.w, bounds.x + dx));
        const newY = Math.max(
          0,
          Math.min(pageHeight - bounds.h, bounds.y + dy),
        );

        onZonesChange(
          zones.map((z) =>
            z.id === selectedZoneId
              ? { ...z, bounds: { ...bounds, x: newX, y: newY } }
              : z,
          ),
        );
      }
    },
    [
      mode,
      drawStart,
      resizeStart,
      activeHandle,
      selectedZoneId,
      dragStart,
      getMousePosition,
      zones,
      onZonesChange,
      pageWidth,
      pageHeight,
    ],
  );

  // Finish any interaction
  const handleMouseUp = useCallback(() => {
    // Finish drawing
    if (
      mode === "drawing" &&
      currentBounds &&
      currentBounds.w >= MIN_ZONE_SIZE &&
      currentBounds.h >= MIN_ZONE_SIZE
    ) {
      const newZone: TemplateZone = {
        id: `zone-${Date.now()}`,
        name: `Zone ${zones.length + 1}`,
        type: "label_value",
        bounds: currentBounds,
        fields: [],
        extractionStrategy: "auto",
      };
      onZonesChange([...zones, newZone]);
      onSelectZone(newZone.id);

      if (onZoneDrawn) {
        onZoneDrawn(newZone, currentBounds);
      }
    }

    // Reset all state
    setMode("none");
    setDrawStart(null);
    setCurrentBounds(null);
    setActiveHandle(null);
    setResizeStart(null);
    setDragStart(null);
  }, [mode, currentBounds, zones, onZonesChange, onSelectZone, onZoneDrawn]);

  // Start resizing from a handle
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, zoneId: string, handle: ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();

      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return;

      const pos = getMousePosition(e);
      setMode("resizing");
      setActiveHandle(handle);
      setResizeStart({ mouse: pos, bounds: { ...zone.bounds } });
      onSelectZone(zoneId);
    },
    [zones, getMousePosition, onSelectZone],
  );

  // Start dragging a zone
  const handleZoneMouseDown = useCallback(
    (e: React.MouseEvent, zoneId: string) => {
      // Don't start drag if in drawing mode
      if (isDrawing) return;

      e.preventDefault();
      e.stopPropagation();

      const zone = zones.find((z) => z.id === zoneId);
      if (!zone) return;

      const pos = getMousePosition(e);
      setMode("dragging");
      setDragStart({ mouse: pos, bounds: { ...zone.bounds } });
      onSelectZone(zoneId);
    },
    [isDrawing, zones, getMousePosition, onSelectZone],
  );

  // Click to select zone
  const handleZoneClick = useCallback(
    (e: React.MouseEvent, zoneId: string) => {
      e.stopPropagation();
      if (mode === "none" && !isDrawing) {
        onSelectZone(zoneId);
      }
    },
    [mode, isDrawing, onSelectZone],
  );

  // Zone colors based on type
  const getZoneStyle = (type: ZoneType, isSelected: boolean) => {
    const colors: Record<ZoneType, { fill: string; stroke: string }> = {
      header: { fill: "rgba(59, 130, 246, 0.15)", stroke: "#3b82f6" },
      table: { fill: "rgba(16, 185, 129, 0.15)", stroke: "#10b981" },
      label_value: { fill: "rgba(249, 115, 22, 0.15)", stroke: "#f97316" },
      multiline: { fill: "rgba(20, 184, 166, 0.15)", stroke: "#14b8a6" },
      list: { fill: "rgba(99, 102, 241, 0.15)", stroke: "#6366f1" },
      date_field: { fill: "rgba(245, 158, 11, 0.15)", stroke: "#f59e0b" },
      amount_field: { fill: "rgba(16, 185, 129, 0.15)", stroke: "#059669" },
    };
    const c = colors[type] || colors.label_value;
    return {
      fill: isSelected ? c.fill.replace("0.15", "0.3") : c.fill,
      stroke: c.stroke,
      strokeWidth: isSelected ? 2.5 : 1.5,
    };
  };

  const getZoneIcon = (type: ZoneType): string => {
    const icons: Record<ZoneType, string> = {
      header: "📋",
      table: "📊",
      label_value: "🏷️",
      multiline: "📝",
      list: "📑",
      date_field: "📅",
      amount_field: "💰",
    };
    return icons[type] || "📋";
  };

  // Render resize handles for selected zone
  const renderResizeHandles = (zone: TemplateZone) => {
    if (zone.id !== selectedZoneId || isDrawing || mode === "drawing")
      return null;

    const { x, y, w, h } = zone.bounds;
    const handles: {
      id: ResizeHandle;
      cx: number;
      cy: number;
      cursor: string;
    }[] = [
      { id: "nw", cx: x, cy: y, cursor: "nwse-resize" },
      { id: "n", cx: x + w / 2, cy: y, cursor: "ns-resize" },
      { id: "ne", cx: x + w, cy: y, cursor: "nesw-resize" },
      { id: "e", cx: x + w, cy: y + h / 2, cursor: "ew-resize" },
      { id: "se", cx: x + w, cy: y + h, cursor: "nwse-resize" },
      { id: "s", cx: x + w / 2, cy: y + h, cursor: "ns-resize" },
      { id: "sw", cx: x, cy: y + h, cursor: "nesw-resize" },
      { id: "w", cx: x, cy: y + h / 2, cursor: "ew-resize" },
    ];
    const style = getZoneStyle(zone.type, true);

    return handles.map((h) => (
      <rect
        key={h.id}
        data-handle={h.id}
        x={h.cx - HANDLE_SIZE / 2}
        y={h.cy - HANDLE_SIZE / 2}
        width={HANDLE_SIZE}
        height={HANDLE_SIZE}
        fill="white"
        stroke={style.stroke}
        strokeWidth={2}
        rx={2}
        style={{ cursor: h.cursor }}
        onMouseDown={(e) => handleResizeStart(e, zone.id, h.id)}
      />
    ));
  };

  // Cursor based on mode
  const getCursor = () => {
    if (mode === "drawing") return "crosshair";
    if (mode === "resizing") return "grabbing";
    if (mode === "dragging") return "grabbing";
    if (isDrawing) return "crosshair";
    return "default";
  };

  return (
    <svg
      ref={svgRef}
      width={pageWidth}
      height={pageHeight}
      className="absolute top-0 left-0"
      style={{ cursor: getCursor(), pointerEvents: "auto" }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Existing zones */}
      {zones.map((zone) => {
        const isSelected = zone.id === selectedZoneId;
        const style = getZoneStyle(zone.type, isSelected);

        return (
          <g key={zone.id}>
            {/* Zone rectangle */}
            <rect
              data-zoneid={zone.id}
              x={zone.bounds.x}
              y={zone.bounds.y}
              width={zone.bounds.w}
              height={zone.bounds.h}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeDasharray={isSelected ? "none" : "5,3"}
              rx={4}
              style={{
                cursor: isDrawing
                  ? "crosshair"
                  : mode === "dragging"
                    ? "grabbing"
                    : "grab",
              }}
              onClick={(e) => handleZoneClick(e, zone.id)}
              onMouseDown={(e) => handleZoneMouseDown(e, zone.id)}
            />

            {/* Zone label */}
            <text
              x={zone.bounds.x + 8}
              y={zone.bounds.y + 18}
              fontSize={12}
              fontWeight={600}
              fill={style.stroke}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {getZoneIcon(zone.type)} {zone.name}
            </text>

            {/* Field count badge */}
            {zone.fields.length > 0 && (
              <g style={{ pointerEvents: "none" }}>
                <rect
                  x={zone.bounds.x + zone.bounds.w - 26}
                  y={zone.bounds.y + 4}
                  width={22}
                  height={18}
                  fill={style.stroke}
                  rx={9}
                />
                <text
                  x={zone.bounds.x + zone.bounds.w - 15}
                  y={zone.bounds.y + 17}
                  fontSize={11}
                  fill="white"
                  textAnchor="middle"
                  fontWeight={600}
                >
                  {zone.fields.length}
                </text>
              </g>
            )}

            {/* Resize handles */}
            {renderResizeHandles(zone)}
          </g>
        );
      })}

      {/* Currently drawing zone */}
      {mode === "drawing" &&
        currentBounds &&
        currentBounds.w > 0 &&
        currentBounds.h > 0 && (
          <rect
            x={currentBounds.x}
            y={currentBounds.y}
            width={currentBounds.w}
            height={currentBounds.h}
            fill="rgba(99, 102, 241, 0.2)"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="8,4"
            rx={4}
            style={{ pointerEvents: "none" }}
          />
        )}
    </svg>
  );
};

export default ZoneOverlay;
