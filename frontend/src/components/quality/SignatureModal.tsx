import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import SignatureCanvas from "react-signature-canvas";
import { X, CheckCircle, RotateCcw, ShieldCheck } from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

/** Manual trim: extracts just the drawn area from a canvas, bypassing broken trim-canvas dep */
function trimCanvasToDataUrl(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas.toDataURL("image/png");
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  let top = height,
    left = width,
    right = 0,
    bottom = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (right <= left || bottom <= top) return canvas.toDataURL("image/png");
  const pad = 10;
  const tLeft = Math.max(0, left - pad);
  const tTop = Math.max(0, top - pad);
  const tWidth = Math.min(width, right - left + pad * 2);
  const tHeight = Math.min(height, bottom - top + pad * 2);
  const trimmed = document.createElement("canvas");
  trimmed.width = tWidth;
  trimmed.height = tHeight;
  trimmed
    .getContext("2d", { willReadFrequently: true })!
    .putImageData(ctx.getImageData(tLeft, tTop, tWidth, tHeight), 0, 0);
  return trimmed.toDataURL("image/png");
}

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: (
    signatureData: string,
    reuseExisting?: boolean,
    evidence?: Record<string, unknown>,
  ) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  allowActionDate?: boolean;
  showActionDate?: boolean;
  actionDateLabel?: string;
  actionDateDisabledMessage?: string;
}

export default function SignatureModal({
  isOpen,
  onClose,
  onSign,
  title = "Digital Signature Required",
  description = "Please provide your signature to proceed.",
  actionLabel = "Authorize Action",
  allowActionDate = false,
  showActionDate = false,
  actionDateLabel = "Approval Date",
  actionDateDisabledMessage = "Manual approval date selection is not enabled.",
}: SignatureModalProps) {
  const { user } = useAuth();
  const sigCanvas = useRef<any>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [useSaved, setUseSaved] = useState<boolean>(false);
  const [actionDate, setActionDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    if (isOpen) {
      // Fetch user's saved signature if any
      api
        .get("/users/me/signature")
        .then((res) => {
          if (res.data?.signatureData) {
            setSavedSignature(res.data.signatureData);
            setUseSaved(false);
          } else {
            setSavedSignature(null);
            setUseSaved(false);
          }
          setActionDate(new Date().toISOString().slice(0, 10));
        })
        .catch((err) => {
          console.error("Failed to load signature", err);
        });
    }
  }, [isOpen]);

  const portalTarget =
    typeof document !== "undefined"
      ? document.fullscreenElement || document.body
      : null;

  if (!isOpen || !portalTarget) return null;

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const handleConfirm = () => {
    const evidence = {
      mode: useSaved && savedSignature ? "SAVED_PROFILE" : "DRAWN_NOW",
      signedAtClient: new Date().toISOString(),
      userAgent: navigator.userAgent,
      signedByUserId: user?.id ?? null,
      signerUsername: user?.username ?? null,
      signerDisplayName: user?.displayName || user?.username || null,
      signerDesignation: user?.designation || null,
      signerRoles: user?.roles || [],
      source: "SETU_WEB_SIGNATURE_MODAL",
      ...(allowActionDate ? { approvalDate: actionDate } : {}),
    };
    if (useSaved && savedSignature) {
      onSign(savedSignature, true, evidence);
    } else {
      if (sigCanvas.current?.isEmpty()) {
        alert("Please provide a signature.");
        return;
      }
      const dataUrl = trimCanvasToDataUrl(sigCanvas.current.getCanvas());
      onSign(dataUrl, false, evidence);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[10000] animate-in fade-in duration-200">
      <div className="bg-surface-card rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-border-default">
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-surface-base/50">
          <div>
            <h3 className="text-lg font-bold text-text-primary">{title}</h3>
            <p className="text-xs text-text-muted mt-1">{description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-text-muted"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              Identity-bound signature
            </div>
            <div className="mt-1">
              Signing as{" "}
              <span className="font-semibold">
                {user?.displayName || user?.username || "logged-in user"}
              </span>
              . SETU will attach your login identity, timestamp, and device
              evidence with the visual signature.
            </div>
          </div>
          {savedSignature && (
            <div className="mb-6 flex space-x-4">
              <label
                className={`flex-1 cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center transition-all ${useSaved ? "border-secondary bg-secondary-muted ring-1 ring-secondary" : "border-border-default hover:border-indigo-300"}`}
              >
                <input
                  type="radio"
                  className="hidden"
                  checked={useSaved}
                  onChange={() => setUseSaved(true)}
                />
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2">
                  Use Saved Profile Signature
                </div>
                <div className="h-16 w-full flex items-center justify-center">
                  <img
                    src={savedSignature}
                    alt="Saved Signature"
                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                  />
                </div>
              </label>

              <label
                className={`flex-1 cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center transition-all ${!useSaved ? "border-secondary bg-secondary-muted ring-1 ring-secondary" : "border-border-default hover:border-indigo-300"}`}
              >
                <input
                  type="radio"
                  className="hidden"
                  checked={!useSaved}
                  onChange={() => setUseSaved(false)}
                />
                <div className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
                  Draw New Signature
                </div>
                <div className="h-16 w-full flex items-center justify-center">
                  <span className="text-text-disabled text-sm">
                    Draw Manually
                  </span>
                </div>
              </label>
            </div>
          )}

          {(allowActionDate || showActionDate) && (
            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                {actionDateLabel}
              </label>
              <input
                type="date"
                value={actionDate}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setActionDate(event.target.value)}
                disabled={!allowActionDate}
                className="mt-1 w-full rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              />
              <p className="mt-1 text-xs text-text-muted">
                {allowActionDate
                  ? "This date will be saved as the approval signature date."
                  : actionDateDisabledMessage}
              </p>
            </div>
          )}

          <div
            className={`border-2 border-dashed border-border-strong rounded-xl bg-surface-base relative overflow-hidden group ${
              useSaved && savedSignature ? "opacity-50" : ""
            }`}
          >
            <SignatureCanvas
              ref={sigCanvas}
              penColor="blue"
              canvasProps={{ className: "w-full h-40 cursor-crosshair" }}
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={clear}
                className="bg-surface-card text-text-secondary p-1.5 rounded-lg shadow-sm border border-border-default hover:bg-surface-base flex items-center gap-1 text-xs font-medium"
              >
                <RotateCcw size={14} /> Clear
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
              <span className="text-[10px] text-gray-300 uppercase tracking-widest font-bold">
                {useSaved && savedSignature
                  ? "Saved profile signature selected"
                  : "Sign Here"}
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border-default text-text-secondary font-medium hover:bg-surface-base transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 flex items-center justify-center gap-2 bg-secondary text-white px-4 py-2.5 rounded-xl font-bold hover:bg-secondary-dark transition-colors shadow-lg shadow-indigo-200"
            >
              <CheckCircle size={18} />
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}
