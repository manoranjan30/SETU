import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Circle as CircleIcon,
  Eraser,
  MousePointer2,
  Pencil,
  Redo2,
  RotateCcw,
  Square,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Arrow,
  Ellipse,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from "react-konva";
import type Konva from "konva";
import { pdfjs } from "react-pdf";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type Tool = "select" | "pen" | "arrow" | "rectangle" | "circle" | "text";
type Shape = {
  id: string;
  type: Exclude<Tool, "select">;
  color: string;
  strokeWidth: number;
  points?: number[];
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radiusX?: number;
  radiusY?: number;
  text?: string;
};

interface Props {
  file: File;
  onCancel: () => void;
  onComplete: (
    annotated: Blob,
    annotationData: Record<string, unknown>,
  ) => void;
}

const colors = ["#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#111827"];
const PDF_RENDER_SCALE = 3;
const MAX_EXPORT_SIDE = 4096;
const TARGET_MAX_ANNOTATED_BYTES = 9.5 * 1024 * 1024;

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("Image export failed"))),
      type,
      quality,
    ),
  );

const exportReadableBlob = async (
  stage: Konva.Stage,
  imageWidth: number,
  imageHeight: number,
  displayScale: number,
) => {
  const maxSide = Math.max(imageWidth, imageHeight);
  const ratio = maxSide > MAX_EXPORT_SIDE ? MAX_EXPORT_SIDE / maxSide : 1;
  const pixelRatio = ratio / displayScale;
  const canvas = stage.toCanvas({ pixelRatio });
  const png = await canvasToBlob(canvas, "image/png");
  if (png.size <= TARGET_MAX_ANNOTATED_BYTES) {
    return png;
  }
  return canvasToBlob(canvas, "image/jpeg", 0.92);
};

export default function ImageAnnotationEditor({
  file,
  onCancel,
  onComplete,
}: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(colors[0]);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [future, setFuture] = useState<Shape[][]>([]);
  const [drawingId, setDrawingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [loadingSource, setLoadingSource] = useState(false);
  const isPdf = file.type === "application/pdf";

  useEffect(() => {
    if (!isPdf) {
      const objectUrl = URL.createObjectURL(file);
      const nextImage = new Image();
      nextImage.onload = () => setImage(nextImage);
      nextImage.src = objectUrl;
      return () => URL.revokeObjectURL(objectUrl);
    }

    let cancelled = false;
    setLoadingSource(true);
    file
      .arrayBuffer()
      .then((data) => pdfjs.getDocument({ data }).promise)
      .then((document) => {
        if (!cancelled) setPdfDocument(document);
      })
      .catch(() => {
        if (!cancelled) alert("Unable to open this PDF for markup.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSource(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file, isPdf]);

  useEffect(() => {
    if (!pdfDocument) return;
    let cancelled = false;
    let objectUrl = "";
    setLoadingSource(true);
    pdfDocument
      .getPage(pdfPageNumber)
      .then(async (page) => {
        const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");
        await page.render({ canvasContext: context, viewport }).promise;
        const blob = await canvasToBlob(canvas, "image/png");
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const nextImage = new Image();
        nextImage.onload = () => {
          if (!cancelled) setImage(nextImage);
        };
        nextImage.src = objectUrl;
      })
      .catch(() => {
        if (!cancelled) alert("Unable to render the selected PDF page.");
      })
      .finally(() => {
        if (!cancelled) setLoadingSource(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pdfDocument, pdfPageNumber]);

  const changePdfPage = (nextPage: number) => {
    if (!pdfDocument || nextPage === pdfPageNumber) return;
    if (
      shapes.length > 0 &&
      !window.confirm("Changing the PDF page will clear the current markup.")
    ) {
      return;
    }
    setShapes([]);
    setHistory([]);
    setFuture([]);
    setZoom(1);
    setPdfPageNumber(nextPage);
  };

  const viewport = useMemo(() => {
    if (!image) return { width: 800, height: 520, scale: 1 };
    const scale = Math.min(900 / image.width, 600 / image.height, 1);
    return {
      width: Math.round(image.width * scale),
      height: Math.round(image.height * scale),
      scale,
    };
  }, [image]);

  const pointer = () => {
    const stage = stageRef.current;
    const point = stage?.getPointerPosition();
    if (!stage || !point) return null;
    return {
      x: (point.x - stage.x()) / (viewport.scale * zoom),
      y: (point.y - stage.y()) / (viewport.scale * zoom),
    };
  };

  const commit = (next: Shape[]) => {
    setHistory((current) => [...current, shapes]);
    setShapes(next);
    setFuture([]);
  };

  const handlePointerDown = () => {
    if (!image || tool === "select") return;
    const point = pointer();
    if (!point) return;
    if (tool === "text") {
      const text = window.prompt("Enter annotation text");
      if (text?.trim()) {
        commit([
          ...shapes,
          {
            id: crypto.randomUUID(),
            type: "text",
            color,
            strokeWidth,
            x: point.x,
            y: point.y,
            text: text.trim(),
          },
        ]);
      }
      return;
    }
    const id = crypto.randomUUID();
    const base: Shape = {
      id,
      type: tool,
      color,
      strokeWidth,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
      radiusX: 0,
      radiusY: 0,
      points: [point.x, point.y, point.x, point.y],
    };
    setHistory((current) => [...current, shapes]);
    setFuture([]);
    setShapes([...shapes, base]);
    setDrawingId(id);
  };

  const handlePointerMove = () => {
    if (!drawingId) return;
    const point = pointer();
    if (!point) return;
    setShapes((current) =>
      current.map((shape) => {
        if (shape.id !== drawingId) return shape;
        if (shape.type === "pen") {
          return { ...shape, points: [...(shape.points || []), point.x, point.y] };
        }
        if (shape.type === "arrow") {
          return {
            ...shape,
            points: [shape.x || 0, shape.y || 0, point.x, point.y],
          };
        }
        const startX = shape.points?.[0] ?? shape.x ?? 0;
        const startY = shape.points?.[1] ?? shape.y ?? 0;
        const width = point.x - startX;
        const height = point.y - startY;
        return shape.type === "circle"
          ? {
              ...shape,
              radiusX: Math.abs(width / 2),
              radiusY: Math.abs(height / 2),
              x: startX + width / 2,
              y: startY + height / 2,
            }
          : { ...shape, width, height };
      }),
    );
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((current) => [shapes, ...current]);
    setShapes(previous);
    setHistory((current) => current.slice(0, -1));
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((current) => [...current, shapes]);
    setShapes(next);
    setFuture((current) => current.slice(1));
  };

  const exportAnnotation = async () => {
    const stage = stageRef.current;
    if (!stage || !image) return;
    const previous = {
      x: stage.x(),
      y: stage.y(),
      scaleX: stage.scaleX(),
      scaleY: stage.scaleY(),
    };
    stage.position({ x: 0, y: 0 });
    stage.scale({ x: viewport.scale, y: viewport.scale });
    try {
      const blob = await exportReadableBlob(
        stage,
        image.width,
        image.height,
        viewport.scale,
      );
      onComplete(blob, {
        version: 1,
        imageWidth: image.width,
        imageHeight: image.height,
        sourceMimeType: file.type,
        pdfPageNumber: isPdf ? pdfPageNumber : undefined,
        pdfPageCount: isPdf ? pdfDocument?.numPages : undefined,
        exportWidth: Math.round(
          image.width *
            Math.min(1, MAX_EXPORT_SIDE / Math.max(image.width, image.height)),
        ),
        exportHeight: Math.round(
          image.height *
            Math.min(1, MAX_EXPORT_SIDE / Math.max(image.width, image.height)),
        ),
        shapes,
      });
    } catch {
      alert("Unable to export the marked-up drawing. Please try again.");
    } finally {
      stage.position({ x: previous.x, y: previous.y });
      stage.scale({ x: previous.scaleX, y: previous.scaleY });
    }
  };

  const toolButtons: Array<[Tool, typeof Pencil, string]> = [
    ["select", MousePointer2, "Pan"],
    ["pen", Pencil, "Pen"],
    ["arrow", ArrowRight, "Arrow"],
    ["rectangle", Square, "Rectangle"],
    ["circle", CircleIcon, "Circle"],
    ["text", Type, "Text"],
  ];

  return (
    <div className="fixed inset-0 z-[12000] flex flex-col bg-gray-950/80 p-3 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-md bg-surface-card shadow-2xl">
        <div className="flex flex-wrap items-center gap-2 border-b border-border-default px-3 py-2">
          {toolButtons.map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              title={label}
              onClick={() => setTool(value)}
              className={`rounded-md p-2 ${tool === value ? "bg-secondary text-white" : "hover:bg-surface-raised"}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-border-default" />
          {colors.map((item) => (
            <button
              key={item}
              type="button"
              title={`Use ${item}`}
              onClick={() => setColor(item)}
              className={`h-6 w-6 rounded-full border-2 ${color === item ? "border-text-primary" : "border-white"}`}
              style={{ backgroundColor: item }}
            />
          ))}
          <select
            value={strokeWidth}
            onChange={(event) => setStrokeWidth(Number(event.target.value))}
            className="rounded-md border border-border-default px-2 py-1 text-sm"
            aria-label="Stroke width"
          >
            <option value={2}>2 px</option>
            <option value={4}>4 px</option>
            <option value={8}>8 px</option>
          </select>
          <span className="mx-1 h-6 w-px bg-border-default" />
          <button type="button" title="Undo" onClick={undo} disabled={!history.length} className="rounded-md p-2 hover:bg-surface-raised disabled:opacity-30">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" title="Redo" onClick={redo} disabled={!future.length} className="rounded-md p-2 hover:bg-surface-raised disabled:opacity-30">
            <Redo2 className="h-4 w-4" />
          </button>
          <button type="button" title="Clear annotations" onClick={() => commit([])} className="rounded-md p-2 hover:bg-surface-raised">
            <Eraser className="h-4 w-4" />
          </button>
          <button type="button" title="Zoom out" onClick={() => setZoom((value) => Math.max(0.5, value - 0.2))} className="rounded-md p-2 hover:bg-surface-raised">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" title="Zoom in" onClick={() => setZoom((value) => Math.min(3, value + 0.2))} className="rounded-md p-2 hover:bg-surface-raised">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" title="Reset view" onClick={() => setZoom(1)} className="rounded-md p-2 hover:bg-surface-raised">
            <RotateCcw className="h-4 w-4" />
          </button>
          <span className="ml-auto text-xs text-text-muted">
            {Math.round(zoom * 100)}%
          </span>
          {isPdf && pdfDocument && (
            <div className="flex items-center gap-2 border-l border-border-default pl-2">
              <button
                type="button"
                onClick={() => changePdfPage(pdfPageNumber - 1)}
                disabled={pdfPageNumber <= 1 || loadingSource}
                className="rounded-md border border-border-default px-2 py-1 text-xs font-semibold disabled:opacity-40"
              >
                Previous
              </button>
              <label className="text-xs font-semibold text-text-secondary">
                Page
                <select
                  value={pdfPageNumber}
                  disabled={loadingSource}
                  onChange={(event) =>
                    changePdfPage(Number(event.target.value))
                  }
                  className="ml-1 rounded-md border border-border-default px-2 py-1"
                >
                  {Array.from(
                    { length: pdfDocument.numPages },
                    (_, index) => index + 1,
                  ).map((page) => (
                    <option key={page} value={page}>
                      {page}
                    </option>
                  ))}
                </select>
                <span className="ml-1">of {pdfDocument.numPages}</span>
              </label>
              <button
                type="button"
                onClick={() => changePdfPage(pdfPageNumber + 1)}
                disabled={
                  pdfPageNumber >= pdfDocument.numPages || loadingSource
                }
                className="rounded-md border border-border-default px-2 py-1 text-xs font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-gray-200 p-4">
          {loadingSource && !image && (
            <div className="text-sm font-semibold text-text-muted">
              Preparing document...
            </div>
          )}
          {image && (
            <Stage
              ref={stageRef}
              width={viewport.width}
              height={viewport.height}
              scaleX={viewport.scale * zoom}
              scaleY={viewport.scale * zoom}
              draggable={tool === "select"}
              onMouseDown={handlePointerDown}
              onTouchStart={handlePointerDown}
              onMouseMove={handlePointerMove}
              onTouchMove={handlePointerMove}
              onMouseUp={() => setDrawingId(null)}
              onTouchEnd={() => setDrawingId(null)}
              className="bg-white shadow-lg"
            >
              <Layer>
                <KonvaImage image={image} width={image.width} height={image.height} />
                {shapes.map((shape) => {
                  if (shape.type === "pen") {
                    return <Line key={shape.id} points={shape.points || []} stroke={shape.color} strokeWidth={shape.strokeWidth} lineCap="round" lineJoin="round" />;
                  }
                  if (shape.type === "arrow") {
                    return <Arrow key={shape.id} points={shape.points || []} stroke={shape.color} fill={shape.color} strokeWidth={shape.strokeWidth} pointerLength={14} pointerWidth={12} />;
                  }
                  if (shape.type === "rectangle") {
                    return <Rect key={shape.id} x={shape.x} y={shape.y} width={shape.width} height={shape.height} stroke={shape.color} strokeWidth={shape.strokeWidth} />;
                  }
                  if (shape.type === "circle") {
                    return <Ellipse key={shape.id} x={shape.x} y={shape.y} radiusX={shape.radiusX || 0} radiusY={shape.radiusY || 0} stroke={shape.color} strokeWidth={shape.strokeWidth} />;
                  }
                  return <Text key={shape.id} x={shape.x} y={shape.y} text={shape.text} fill={shape.color} fontSize={Math.max(16, shape.strokeWidth * 5)} />;
                })}
              </Layer>
            </Stage>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border-default px-4 py-3">
          <button type="button" onClick={onCancel} className="rounded-md border border-border-default px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button type="button" onClick={exportAnnotation} className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-white">
            Save Markup
          </button>
        </div>
      </div>
    </div>
  );
}
