import React, { useRef, useState, useEffect } from "react";
import { Eraser, Check } from "lucide-react";

interface Props {
  onSave: (signatureData: string) => void;
  onClear?: () => void;
}

const SignaturePad: React.FC<Props> = ({ onSave, onClear }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const computed = getComputedStyle(document.documentElement);
    const stroke = computed.getPropertyValue("--color-text-primary").trim() || "#0f172a";

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const getPos = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX: number;
    let clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasContent(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    if (onClear) onClear();
  };

  const save = () => {
    if (!hasContent) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl border border-border-default bg-surface-card shadow-inner overflow-hidden cursor-crosshair h-48">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseOut={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          className="w-full h-full touch-none"
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-semibold text-text-muted">
              Draw signature here
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center px-1">
        <button
          type="button"
          onClick={clear}
          className="ui-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider"
        >
          <Eraser className="w-4 h-4" /> Clear
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!hasContent}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm uppercase tracking-wider bg-primary text-white disabled:bg-surface-raised disabled:text-text-disabled disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" /> Confirm
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
