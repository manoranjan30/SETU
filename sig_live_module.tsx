import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/components/quality/SignatureModal.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=9bf30538"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
var _s = $RefreshSig$();
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=9bf30538"; const useRef = __vite__cjsImport1_react["useRef"]; const useState = __vite__cjsImport1_react["useState"]; const useEffect = __vite__cjsImport1_react["useEffect"];
import SignatureCanvas from "/node_modules/.vite/deps/react-signature-canvas.js?v=9bf30538";
import { X, CheckCircle, RotateCcw } from "/node_modules/.vite/deps/lucide-react.js?v=9bf30538";
import api from "/src/api/axios.ts";
function trimCanvasToDataUrl(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas.toDataURL("image/png");
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  let top = height, left = width, right = 0, bottom = 0;
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
  trimmed.getContext("2d", { willReadFrequently: true }).putImageData(ctx.getImageData(tLeft, tTop, tWidth, tHeight), 0, 0);
  return trimmed.toDataURL("image/png");
}
export default function SignatureModal({
  isOpen,
  onClose,
  onSign,
  title = "Digital Signature Required",
  description = "Please provide your signature to proceed.",
  actionLabel = "Authorize Action"
}) {
  _s();
  const sigCanvas = useRef(null);
  const [savedSignature, setSavedSignature] = useState(null);
  const [useSaved, setUseSaved] = useState(true);
  useEffect(() => {
    if (isOpen) {
      api.get("/users/me/signature").then((res) => {
        if (res.data?.signatureData) {
          setSavedSignature(res.data.signatureData);
          setUseSaved(true);
        } else {
          setSavedSignature(null);
          setUseSaved(false);
        }
      }).catch((err) => {
        console.error("Failed to load signature", err);
      });
    }
  }, [isOpen]);
  if (!isOpen) return null;
  const clear = () => {
    sigCanvas.current?.clear();
  };
  const handleConfirm = () => {
    if (useSaved && savedSignature) {
      onSign(savedSignature, true);
    } else {
      if (sigCanvas.current?.isEmpty()) {
        alert("Please provide a signature.");
        return;
      }
      const dataUrl = trimCanvasToDataUrl(sigCanvas.current.getCanvas());
      onSign(dataUrl, false);
    }
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-surface-card rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-border-default", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-center p-4 border-b border-border-subtle bg-surface-base/50", children: [
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-bold text-text-primary", children: title }, void 0, false, {
          fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
          lineNumber: 108,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-xs text-text-muted mt-1", children: description }, void 0, false, {
          fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
          lineNumber: 109,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
        lineNumber: 107,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          onClick: onClose,
          className: "p-2 hover:bg-gray-200 rounded-full transition-colors text-text-muted",
          children: /* @__PURE__ */ jsxDEV(X, { size: 18 }, void 0, false, {
            fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
            lineNumber: 115,
            columnNumber: 13
          }, this)
        },
        void 0,
        false,
        {
          fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
          lineNumber: 111,
          columnNumber: 11
        },
        this
      )
    ] }, void 0, true, {
      fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
      lineNumber: 106,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "p-6", children: [
      savedSignature && /* @__PURE__ */ jsxDEV("div", { className: "mb-6 flex space-x-4", children: [
        /* @__PURE__ */ jsxDEV(
          "label",
          {
            className: `flex-1 cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center transition-all ${useSaved ? "border-secondary bg-secondary-muted ring-1 ring-secondary" : "border-border-default hover:border-indigo-300"}`,
            children: [
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "radio",
                  className: "hidden",
                  checked: useSaved,
                  onChange: () => setUseSaved(true)
                },
                void 0,
                false,
                {
                  fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                  lineNumber: 125,
                  columnNumber: 17
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("div", { className: "text-xs font-bold uppercase tracking-wider text-indigo-700 mb-2", children: "Use Saved Profile Signature" }, void 0, false, {
                fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                lineNumber: 131,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "h-16 w-full flex items-center justify-center", children: /* @__PURE__ */ jsxDEV(
                "img",
                {
                  src: savedSignature,
                  alt: "Saved Signature",
                  className: "max-h-full max-w-full object-contain mix-blend-multiply"
                },
                void 0,
                false,
                {
                  fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                  lineNumber: 135,
                  columnNumber: 19
                },
                this
              ) }, void 0, false, {
                fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                lineNumber: 134,
                columnNumber: 17
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
            lineNumber: 122,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "label",
          {
            className: `flex-1 cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center transition-all ${!useSaved ? "border-secondary bg-secondary-muted ring-1 ring-secondary" : "border-border-default hover:border-indigo-300"}`,
            children: [
              /* @__PURE__ */ jsxDEV(
                "input",
                {
                  type: "radio",
                  className: "hidden",
                  checked: !useSaved,
                  onChange: () => setUseSaved(false)
                },
                void 0,
                false,
                {
                  fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                  lineNumber: 146,
                  columnNumber: 17
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("div", { className: "text-xs font-bold uppercase tracking-wider text-text-secondary mb-2", children: "Draw New Signature" }, void 0, false, {
                fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                lineNumber: 152,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("div", { className: "h-16 w-full flex items-center justify-center", children: /* @__PURE__ */ jsxDEV("span", { className: "text-text-disabled text-sm", children: "Draw Manually" }, void 0, false, {
                fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                lineNumber: 156,
                columnNumber: 19
              }, this) }, void 0, false, {
                fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                lineNumber: 155,
                columnNumber: 17
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
            lineNumber: 143,
            columnNumber: 15
          },
          this
        )
      ] }, void 0, true, {
        fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
        lineNumber: 121,
        columnNumber: 11
      }, this),
      (!savedSignature || !useSaved) && /* @__PURE__ */ jsxDEV("div", { className: "border-2 border-dashed border-border-strong rounded-xl bg-surface-base relative overflow-hidden group", children: [
        /* @__PURE__ */ jsxDEV(
          SignatureCanvas,
          {
            ref: sigCanvas,
            penColor: "blue",
            canvasProps: { className: "w-full h-40 cursor-crosshair" }
          },
          void 0,
          false,
          {
            fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
            lineNumber: 166,
            columnNumber: 15
          },
          this
        ),
        /* @__PURE__ */ jsxDEV("div", { className: "absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity", children: /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: clear,
            className: "bg-surface-card text-text-secondary p-1.5 rounded-lg shadow-sm border border-border-default hover:bg-surface-base flex items-center gap-1 text-xs font-medium",
            children: [
              /* @__PURE__ */ jsxDEV(RotateCcw, { size: 14 }, void 0, false, {
                fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                lineNumber: 176,
                columnNumber: 19
              }, this),
              " Clear"
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
            lineNumber: 172,
            columnNumber: 17
          },
          this
        ) }, void 0, false, {
          fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
          lineNumber: 171,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "absolute inset-x-0 bottom-3 flex justify-center pointer-events-none", children: /* @__PURE__ */ jsxDEV("span", { className: "text-[10px] text-gray-300 uppercase tracking-widest font-bold", children: "Sign Here" }, void 0, false, {
          fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
          lineNumber: 180,
          columnNumber: 17
        }, this) }, void 0, false, {
          fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
          lineNumber: 179,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
        lineNumber: 165,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "mt-6 flex gap-3", children: [
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: onClose,
            className: "flex-1 px-4 py-2.5 rounded-xl border border-border-default text-text-secondary font-medium hover:bg-surface-base transition-colors",
            children: "Cancel"
          },
          void 0,
          false,
          {
            fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
            lineNumber: 188,
            columnNumber: 13
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: handleConfirm,
            className: "flex-1 flex items-center justify-center gap-2 bg-secondary text-white px-4 py-2.5 rounded-xl font-bold hover:bg-secondary-dark transition-colors shadow-lg shadow-indigo-200",
            children: [
              /* @__PURE__ */ jsxDEV(CheckCircle, { size: 18 }, void 0, false, {
                fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
                lineNumber: 198,
                columnNumber: 15
              }, this),
              actionLabel
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
            lineNumber: 194,
            columnNumber: 13
          },
          this
        )
      ] }, void 0, true, {
        fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
        lineNumber: 187,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
      lineNumber: 119,
      columnNumber: 9
    }, this)
  ] }, void 0, true, {
    fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
    lineNumber: 105,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/app/frontend/src/components/quality/SignatureModal.tsx",
    lineNumber: 104,
    columnNumber: 5
  }, this);
}
_s(SignatureModal, "2jscQ22lg3LseP2Bgf/8JY/bZPQ=");
_c = SignatureModal;
var _c;
$RefreshReg$(_c, "SignatureModal");
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/app/frontend/src/components/quality/SignatureModal.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/app/frontend/src/components/quality/SignatureModal.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}
function $RefreshReg$(type, id) {
  return RefreshRuntime.register(type, "/app/frontend/src/components/quality/SignatureModal.tsx " + id);
}
function $RefreshSig$() {
  return RefreshRuntime.createSignatureFunctionForTransform();
}

//# sourceMappingURL=data:application/json;base64,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QUFBQUEsWUFDVCxXQUFVO0FBQUEsWUFBb0k7QUFBQTtBQUFBLFVBRmhKO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQUtBO0FBQUEsUUFDQTtBQUFBLFVBQUM7QUFBQTtBQUFBLFlBQ0MsU0FBU3FCO0FBQUFBLFlBQ1QsV0FBVTtBQUFBLFlBRVY7QUFBQSxxQ0FBQyxlQUFZLE1BQU0sTUFBbkI7QUFBQTtBQUFBO0FBQUE7QUFBQSxxQkFBc0I7QUFBQSxjQUNyQmpCO0FBQUFBO0FBQUFBO0FBQUFBLFVBTEg7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBTUE7QUFBQSxXQWJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFjQTtBQUFBLFNBbEZGO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FtRkE7QUFBQSxPQWpHRjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBa0dBLEtBbkdGO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FvR0E7QUFFSjtBQUFDQyxHQTFKdUJQLGdCQUFjO0FBQUE2QixLQUFkN0I7QUFBYyxJQUFBNkI7QUFBQUMsYUFBQUQsSUFBQSIsIm5hbWVzIjpbInVzZVJlZiIsInVzZVN0YXRlIiwidXNlRWZmZWN0IiwiU2lnbmF0dXJlQ2FudmFzIiwiWCIsIkNoZWNrQ2lyY2xlIiwiUm90YXRlQ2N3IiwiYXBpIiwidHJpbUNhbnZhc1RvRGF0YVVybCIsImNhbnZhcyIsImN0eCIsImdldENvbnRleHQiLCJ3aWxsUmVhZEZyZXF1ZW50bHkiLCJ0b0RhdGFVUkwiLCJ3aWR0aCIsImhlaWdodCIsImltYWdlRGF0YSIsImdldEltYWdlRGF0YSIsImRhdGEiLCJ0b3AiLCJsZWZ0IiwicmlnaHQiLCJib3R0b20iLCJ5IiwieCIsImFscGhhIiwicGFkIiwidExlZnQiLCJNYXRoIiwibWF4IiwidFRvcCIsInRXaWR0aCIsIm1pbiIsInRIZWlnaHQiLCJ0cmltbWVkIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwicHV0SW1hZ2VEYXRhIiwiU2lnbmF0dXJlTW9kYWwiLCJpc09wZW4iLCJvbkNsb3NlIiwib25TaWduIiwidGl0bGUiLCJkZXNjcmlwdGlvbiIsImFjdGlvbkxhYmVsIiwiX3MiLCJzaWdDYW52YXMiLCJzYXZlZFNpZ25hdHVyZSIsInNldFNhdmVkU2lnbmF0dXJlIiwidXNlU2F2ZWQiLCJzZXRVc2VTYXZlZCIsImdldCIsInRoZW4iLCJyZXMiLCJzaWduYXR1cmVEYXRhIiwiY2F0Y2giLCJlcnIiLCJjb25zb2xlIiwiZXJyb3IiLCJjbGVhciIsImN1cnJlbnQiLCJoYW5kbGVDb25maXJtIiwiaXNFbXB0eSIsImFsZXJ0IiwiZGF0YVVybCIsImdldENhbnZhcyIsImNsYXNzTmFtZSIsIl9jIiwiJFJlZnJlc2hSZWckIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIlNpZ25hdHVyZU1vZGFsLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyB1c2VSZWYsIHVzZVN0YXRlLCB1c2VFZmZlY3QgfSBmcm9tIFwicmVhY3RcIjtcbmltcG9ydCBTaWduYXR1cmVDYW52YXMgZnJvbSBcInJlYWN0LXNpZ25hdHVyZS1jYW52YXNcIjtcbmltcG9ydCB7IFgsIENoZWNrQ2lyY2xlLCBSb3RhdGVDY3cgfSBmcm9tIFwibHVjaWRlLXJlYWN0XCI7XG5pbXBvcnQgYXBpIGZyb20gXCIuLi8uLi9hcGkvYXhpb3NcIjtcblxuLyoqIE1hbnVhbCB0cmltOiBleHRyYWN0cyBqdXN0IHRoZSBkcmF3biBhcmVhIGZyb20gYSBjYW52YXMsIGJ5cGFzc2luZyBicm9rZW4gdHJpbS1jYW52YXMgZGVwICovXG5mdW5jdGlvbiB0cmltQ2FudmFzVG9EYXRhVXJsKGNhbnZhczogSFRNTENhbnZhc0VsZW1lbnQpOiBzdHJpbmcge1xuICBjb25zdCBjdHggPSBjYW52YXMuZ2V0Q29udGV4dChcIjJkXCIsIHsgd2lsbFJlYWRGcmVxdWVudGx5OiB0cnVlIH0pO1xuICBpZiAoIWN0eCkgcmV0dXJuIGNhbnZhcy50b0RhdGFVUkwoXCJpbWFnZS9wbmdcIik7XG4gIGNvbnN0IHsgd2lkdGgsIGhlaWdodCB9ID0gY2FudmFzO1xuICBjb25zdCBpbWFnZURhdGEgPSBjdHguZ2V0SW1hZ2VEYXRhKDAsIDAsIHdpZHRoLCBoZWlnaHQpO1xuICBjb25zdCB7IGRhdGEgfSA9IGltYWdlRGF0YTtcbiAgbGV0IHRvcCA9IGhlaWdodCxcbiAgICBsZWZ0ID0gd2lkdGgsXG4gICAgcmlnaHQgPSAwLFxuICAgIGJvdHRvbSA9IDA7XG4gIGZvciAobGV0IHkgPSAwOyB5IDwgaGVpZ2h0OyB5KyspIHtcbiAgICBmb3IgKGxldCB4ID0gMDsgeCA8IHdpZHRoOyB4KyspIHtcbiAgICAgIGNvbnN0IGFscGhhID0gZGF0YVsoeSAqIHdpZHRoICsgeCkgKiA0ICsgM107XG4gICAgICBpZiAoYWxwaGEgPiAwKSB7XG4gICAgICAgIGlmICh5IDwgdG9wKSB0b3AgPSB5O1xuICAgICAgICBpZiAoeSA+IGJvdHRvbSkgYm90dG9tID0geTtcbiAgICAgICAgaWYgKHggPCBsZWZ0KSBsZWZ0ID0geDtcbiAgICAgICAgaWYgKHggPiByaWdodCkgcmlnaHQgPSB4O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAocmlnaHQgPD0gbGVmdCB8fCBib3R0b20gPD0gdG9wKSByZXR1cm4gY2FudmFzLnRvRGF0YVVSTChcImltYWdlL3BuZ1wiKTtcbiAgY29uc3QgcGFkID0gMTA7XG4gIGNvbnN0IHRMZWZ0ID0gTWF0aC5tYXgoMCwgbGVmdCAtIHBhZCk7XG4gIGNvbnN0IHRUb3AgPSBNYXRoLm1heCgwLCB0b3AgLSBwYWQpO1xuICBjb25zdCB0V2lkdGggPSBNYXRoLm1pbih3aWR0aCwgcmlnaHQgLSBsZWZ0ICsgcGFkICogMik7XG4gIGNvbnN0IHRIZWlnaHQgPSBNYXRoLm1pbihoZWlnaHQsIGJvdHRvbSAtIHRvcCArIHBhZCAqIDIpO1xuICBjb25zdCB0cmltbWVkID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImNhbnZhc1wiKTtcbiAgdHJpbW1lZC53aWR0aCA9IHRXaWR0aDtcbiAgdHJpbW1lZC5oZWlnaHQgPSB0SGVpZ2h0O1xuICB0cmltbWVkXG4gICAgLmdldENvbnRleHQoXCIyZFwiLCB7IHdpbGxSZWFkRnJlcXVlbnRseTogdHJ1ZSB9KSFcbiAgICAucHV0SW1hZ2VEYXRhKGN0eC5nZXRJbWFnZURhdGEodExlZnQsIHRUb3AsIHRXaWR0aCwgdEhlaWdodCksIDAsIDApO1xuICByZXR1cm4gdHJpbW1lZC50b0RhdGFVUkwoXCJpbWFnZS9wbmdcIik7XG59XG5cbmludGVyZmFjZSBTaWduYXR1cmVNb2RhbFByb3BzIHtcbiAgaXNPcGVuOiBib29sZWFuO1xuICBvbkNsb3NlOiAoKSA9PiB2b2lkO1xuICBvblNpZ246IChzaWduYXR1cmVEYXRhOiBzdHJpbmcsIHJldXNlRXhpc3Rpbmc/OiBib29sZWFuKSA9PiB2b2lkO1xuICB0aXRsZT86IHN0cmluZztcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gIGFjdGlvbkxhYmVsPzogc3RyaW5nO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBTaWduYXR1cmVNb2RhbCh7XG4gIGlzT3BlbixcbiAgb25DbG9zZSxcbiAgb25TaWduLFxuICB0aXRsZSA9IFwiRGlnaXRhbCBTaWduYXR1cmUgUmVxdWlyZWRcIixcbiAgZGVzY3JpcHRpb24gPSBcIlBsZWFzZSBwcm92aWRlIHlvdXIgc2lnbmF0dXJlIHRvIHByb2NlZWQuXCIsXG4gIGFjdGlvbkxhYmVsID0gXCJBdXRob3JpemUgQWN0aW9uXCIsXG59OiBTaWduYXR1cmVNb2RhbFByb3BzKSB7XG4gIGNvbnN0IHNpZ0NhbnZhcyA9IHVzZVJlZjxhbnk+KG51bGwpO1xuICBjb25zdCBbc2F2ZWRTaWduYXR1cmUsIHNldFNhdmVkU2lnbmF0dXJlXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpO1xuICBjb25zdCBbdXNlU2F2ZWQsIHNldFVzZVNhdmVkXSA9IHVzZVN0YXRlPGJvb2xlYW4+KHRydWUpO1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKGlzT3Blbikge1xuICAgICAgLy8gRmV0Y2ggdXNlcidzIHNhdmVkIHNpZ25hdHVyZSBpZiBhbnlcbiAgICAgIGFwaVxuICAgICAgICAuZ2V0KFwiL3VzZXJzL21lL3NpZ25hdHVyZVwiKVxuICAgICAgICAudGhlbigocmVzKSA9PiB7XG4gICAgICAgICAgaWYgKHJlcy5kYXRhPy5zaWduYXR1cmVEYXRhKSB7XG4gICAgICAgICAgICBzZXRTYXZlZFNpZ25hdHVyZShyZXMuZGF0YS5zaWduYXR1cmVEYXRhKTtcbiAgICAgICAgICAgIHNldFVzZVNhdmVkKHRydWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzZXRTYXZlZFNpZ25hdHVyZShudWxsKTtcbiAgICAgICAgICAgIHNldFVzZVNhdmVkKGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pXG4gICAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byBsb2FkIHNpZ25hdHVyZVwiLCBlcnIpO1xuICAgICAgICB9KTtcbiAgICB9XG4gIH0sIFtpc09wZW5dKTtcblxuICBpZiAoIWlzT3BlbikgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgY2xlYXIgPSAoKSA9PiB7XG4gICAgc2lnQ2FudmFzLmN1cnJlbnQ/LmNsZWFyKCk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQ29uZmlybSA9ICgpID0+IHtcbiAgICBpZiAodXNlU2F2ZWQgJiYgc2F2ZWRTaWduYXR1cmUpIHtcbiAgICAgIG9uU2lnbihzYXZlZFNpZ25hdHVyZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChzaWdDYW52YXMuY3VycmVudD8uaXNFbXB0eSgpKSB7XG4gICAgICAgIGFsZXJ0KFwiUGxlYXNlIHByb3ZpZGUgYSBzaWduYXR1cmUuXCIpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBkYXRhVXJsID0gdHJpbUNhbnZhc1RvRGF0YVVybChzaWdDYW52YXMuY3VycmVudC5nZXRDYW52YXMoKSk7XG4gICAgICBvblNpZ24oZGF0YVVybCwgZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgaW5zZXQtMCBiZy1ncmF5LTkwMC82MCBiYWNrZHJvcC1ibHVyLXNtIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHotWzEwMF0gYW5pbWF0ZS1pbiBmYWRlLWluIGR1cmF0aW9uLTIwMFwiPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy1zdXJmYWNlLWNhcmQgcm91bmRlZC0yeGwgdy1mdWxsIG1heC13LW1kIG92ZXJmbG93LWhpZGRlbiBzaGFkb3cteGwgYm9yZGVyIGJvcmRlci1ib3JkZXItZGVmYXVsdFwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgganVzdGlmeS1iZXR3ZWVuIGl0ZW1zLWNlbnRlciBwLTQgYm9yZGVyLWIgYm9yZGVyLWJvcmRlci1zdWJ0bGUgYmctc3VyZmFjZS1iYXNlLzUwXCI+XG4gICAgICAgICAgPGRpdj5cbiAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtYm9sZCB0ZXh0LXRleHQtcHJpbWFyeVwiPnt0aXRsZX08L2gzPlxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC14cyB0ZXh0LXRleHQtbXV0ZWQgbXQtMVwiPntkZXNjcmlwdGlvbn08L3A+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgb25DbGljaz17b25DbG9zZX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInAtMiBob3ZlcjpiZy1ncmF5LTIwMCByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1jb2xvcnMgdGV4dC10ZXh0LW11dGVkXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8WCBzaXplPXsxOH0gLz5cbiAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwLTZcIj5cbiAgICAgICAgICB7c2F2ZWRTaWduYXR1cmUgJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYi02IGZsZXggc3BhY2UteC00XCI+XG4gICAgICAgICAgICAgIDxsYWJlbFxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YGZsZXgtMSBjdXJzb3ItcG9pbnRlciBib3JkZXIgcm91bmRlZC14bCBwLTQgZmxleCBmbGV4LWNvbCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgdHJhbnNpdGlvbi1hbGwgJHt1c2VTYXZlZCA/IFwiYm9yZGVyLXNlY29uZGFyeSBiZy1zZWNvbmRhcnktbXV0ZWQgcmluZy0xIHJpbmctc2Vjb25kYXJ5XCIgOiBcImJvcmRlci1ib3JkZXItZGVmYXVsdCBob3Zlcjpib3JkZXItaW5kaWdvLTMwMFwifWB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJyYWRpb1wiXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJoaWRkZW5cIlxuICAgICAgICAgICAgICAgICAgY2hlY2tlZD17dXNlU2F2ZWR9XG4gICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KCkgPT4gc2V0VXNlU2F2ZWQodHJ1ZSl9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1ib2xkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlciB0ZXh0LWluZGlnby03MDAgbWItMlwiPlxuICAgICAgICAgICAgICAgICAgVXNlIFNhdmVkIFByb2ZpbGUgU2lnbmF0dXJlXG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJoLTE2IHctZnVsbCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgPGltZ1xuICAgICAgICAgICAgICAgICAgICBzcmM9e3NhdmVkU2lnbmF0dXJlfVxuICAgICAgICAgICAgICAgICAgICBhbHQ9XCJTYXZlZCBTaWduYXR1cmVcIlxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJtYXgtaC1mdWxsIG1heC13LWZ1bGwgb2JqZWN0LWNvbnRhaW4gbWl4LWJsZW5kLW11bHRpcGx5XCJcbiAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgIDwvbGFiZWw+XG5cbiAgICAgICAgICAgICAgPGxhYmVsXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgZmxleC0xIGN1cnNvci1wb2ludGVyIGJvcmRlciByb3VuZGVkLXhsIHAtNCBmbGV4IGZsZXgtY29sIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB0cmFuc2l0aW9uLWFsbCAkeyF1c2VTYXZlZCA/IFwiYm9yZGVyLXNlY29uZGFyeSBiZy1zZWNvbmRhcnktbXV0ZWQgcmluZy0xIHJpbmctc2Vjb25kYXJ5XCIgOiBcImJvcmRlci1ib3JkZXItZGVmYXVsdCBob3Zlcjpib3JkZXItaW5kaWdvLTMwMFwifWB9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgIHR5cGU9XCJyYWRpb1wiXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJoaWRkZW5cIlxuICAgICAgICAgICAgICAgICAgY2hlY2tlZD17IXVzZVNhdmVkfVxuICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eygpID0+IHNldFVzZVNhdmVkKGZhbHNlKX1cbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LWJvbGQgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIHRleHQtdGV4dC1zZWNvbmRhcnkgbWItMlwiPlxuICAgICAgICAgICAgICAgICAgRHJhdyBOZXcgU2lnbmF0dXJlXG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJoLTE2IHctZnVsbCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlclwiPlxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC10ZXh0LWRpc2FibGVkIHRleHQtc21cIj5cbiAgICAgICAgICAgICAgICAgICAgRHJhdyBNYW51YWxseVxuICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8L2xhYmVsPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cblxuICAgICAgICAgIHsoIXNhdmVkU2lnbmF0dXJlIHx8ICF1c2VTYXZlZCkgJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJib3JkZXItMiBib3JkZXItZGFzaGVkIGJvcmRlci1ib3JkZXItc3Ryb25nIHJvdW5kZWQteGwgYmctc3VyZmFjZS1iYXNlIHJlbGF0aXZlIG92ZXJmbG93LWhpZGRlbiBncm91cFwiPlxuICAgICAgICAgICAgICA8U2lnbmF0dXJlQ2FudmFzXG4gICAgICAgICAgICAgICAgcmVmPXtzaWdDYW52YXN9XG4gICAgICAgICAgICAgICAgcGVuQ29sb3I9XCJibHVlXCJcbiAgICAgICAgICAgICAgICBjYW52YXNQcm9wcz17eyBjbGFzc05hbWU6IFwidy1mdWxsIGgtNDAgY3Vyc29yLWNyb3NzaGFpclwiIH19XG4gICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgdG9wLTIgcmlnaHQtMiBvcGFjaXR5LTAgZ3JvdXAtaG92ZXI6b3BhY2l0eS0xMDAgdHJhbnNpdGlvbi1vcGFjaXR5XCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17Y2xlYXJ9XG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1zdXJmYWNlLWNhcmQgdGV4dC10ZXh0LXNlY29uZGFyeSBwLTEuNSByb3VuZGVkLWxnIHNoYWRvdy1zbSBib3JkZXIgYm9yZGVyLWJvcmRlci1kZWZhdWx0IGhvdmVyOmJnLXN1cmZhY2UtYmFzZSBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSB0ZXh0LXhzIGZvbnQtbWVkaXVtXCJcbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8Um90YXRlQ2N3IHNpemU9ezE0fSAvPiBDbGVhclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSBpbnNldC14LTAgYm90dG9tLTMgZmxleCBqdXN0aWZ5LWNlbnRlciBwb2ludGVyLWV2ZW50cy1ub25lXCI+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1bMTBweF0gdGV4dC1ncmF5LTMwMCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXN0IGZvbnQtYm9sZFwiPlxuICAgICAgICAgICAgICAgICAgU2lnbiBIZXJlXG4gICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICl9XG5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LTYgZmxleCBnYXAtM1wiPlxuICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICBvbkNsaWNrPXtvbkNsb3NlfVxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4LTEgcHgtNCBweS0yLjUgcm91bmRlZC14bCBib3JkZXIgYm9yZGVyLWJvcmRlci1kZWZhdWx0IHRleHQtdGV4dC1zZWNvbmRhcnkgZm9udC1tZWRpdW0gaG92ZXI6Ymctc3VyZmFjZS1iYXNlIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgQ2FuY2VsXG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlQ29uZmlybX1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleC0xIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGdhcC0yIGJnLXNlY29uZGFyeSB0ZXh0LXdoaXRlIHB4LTQgcHktMi41IHJvdW5kZWQteGwgZm9udC1ib2xkIGhvdmVyOmJnLXNlY29uZGFyeS1kYXJrIHRyYW5zaXRpb24tY29sb3JzIHNoYWRvdy1sZyBzaGFkb3ctaW5kaWdvLTIwMFwiXG4gICAgICAgICAgICA+XG4gICAgICAgICAgICAgIDxDaGVja0NpcmNsZSBzaXplPXsxOH0gLz5cbiAgICAgICAgICAgICAge2FjdGlvbkxhYmVsfVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gICk7XG59XG4iXSwiZmlsZSI6Ii9hcHAvZnJvbnRlbmQvc3JjL2NvbXBvbmVudHMvcXVhbGl0eS9TaWduYXR1cmVNb2RhbC50c3gifQ==
