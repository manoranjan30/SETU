/**
 * CadViewer — DXF/DWG viewer with measurement tools.
 *
 * Key design decisions:
 * - OrbitControls (orthographic) only changes camera.zoom, NOT camera.top/bottom.
 *   So "world units per screen pixel" = (top-bottom) / (zoom * canvasH).
 *   All overlay sprites are sized using this formula every frame, giving
 *   constant pixel size independent of zoom.
 * - ACI colors: DXF uses AutoCAD Color Index (integer), NOT hex. We map it here.
 * - Arc/Ellipse angles: dxf-parser returns degrees; EllipseCurve expects radians.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import DxfParser from "dxf-parser";
import {
  MousePointer2,
  Ruler,
  Square,
  Loader2,
  RefreshCw,
  Layers,
  Crosshair,
  Settings2,
  Trash2,
} from "lucide-react";

// ─── AutoCAD Color Index (ACI) → hex ─────────────────────────────────────────
// Standard colors 1-9. Extended 10-249 follow hue bands; 250-255 are grays.
const ACI_COLORS: Record<number, string> = {
  0: "#FFFFFF",  // BYBLOCK
  1: "#FF0000", 2: "#FFFF00", 3: "#00FF00", 4: "#00FFFF",
  5: "#0000FF", 6: "#FF00FF", 7: "#FFFFFF", 8: "#414141", 9: "#808080",
  // reds
  10:"#FF0000",11:"#FF7F7F",12:"#A50000",13:"#A57F7F",14:"#7F0000",15:"#7F3F3F",16:"#4B0000",17:"#4B2626",18:"#260000",19:"#261313",
  // orange-red
  20:"#FF3F00",21:"#FF9F7F",22:"#A52900",23:"#A5724F",24:"#7F1E00",25:"#7F4F3F",26:"#4B1300",27:"#4B2F26",28:"#260900",29:"#261713",
  // orange
  30:"#FF7F00",31:"#FFBF7F",32:"#A55200",33:"#A5824F",34:"#7F3F00",35:"#7F5F3F",36:"#4B2600",37:"#4B3926",38:"#261300",39:"#261C13",
  // gold
  40:"#FFBF00",41:"#FFDF7F",42:"#A57C00",43:"#A59A4F",44:"#7F5F00",45:"#7F6F3F",46:"#4B3900",47:"#4B4326",48:"#261C00",49:"#262113",
  // yellow
  50:"#FFFF00",51:"#FFFF7F",52:"#A5A500",53:"#A5A54F",54:"#7F7F00",55:"#7F7F3F",56:"#4B4B00",57:"#4B4B26",58:"#262600",59:"#262613",
  // yellow-green
  60:"#BFFF00",61:"#DFFF7F",62:"#7CA500",63:"#92A54F",64:"#5F7F00",65:"#6F7F3F",66:"#394B00",67:"#424B26",68:"#1C2600",69:"#212613",
  // lime
  70:"#7FFF00",71:"#BFFF7F",72:"#52A500",73:"#82A54F",74:"#3F7F00",75:"#5F7F3F",76:"#264B00",77:"#3B4B26",78:"#132600",79:"#1C2613",
  // spring-green
  80:"#3FFF00",81:"#9FFF7F",82:"#29A500",83:"#72A54F",84:"#1F7F00",85:"#4F7F3F",86:"#134B00",87:"#2F4B26",88:"#092600",89:"#172613",
  // green
  90:"#00FF00",91:"#7FFF7F",92:"#00A500",93:"#4FA54F",94:"#007F00",95:"#3F7F3F",96:"#004B00",97:"#264B26",98:"#002600",99:"#132613",
  // mint
  100:"#00FF3F",101:"#7FFF9F",102:"#00A529",103:"#4FA572",104:"#007F1E",105:"#3F7F4F",106:"#004B13",107:"#264B2F",108:"#002609",109:"#132617",
  // teal-green
  110:"#00FF7F",111:"#7FFFBF",112:"#00A552",113:"#4FA582",114:"#007F3F",115:"#3F7F5F",116:"#004B26",117:"#264B3B",118:"#002613",119:"#13261C",
  // cyan-green
  120:"#00FFBF",121:"#7FFFDF",122:"#00A57C",123:"#4FA592",124:"#007F5F",125:"#3F7F6F",126:"#004B39",127:"#264B42",128:"#00261C",129:"#132621",
  // cyan
  130:"#00FFFF",131:"#7FFFFF",132:"#00A5A5",133:"#4FA5A5",134:"#007F7F",135:"#3F7F7F",136:"#004B4B",137:"#264B4B",138:"#002626",139:"#132626",
  // sky
  140:"#00BFFF",141:"#7FDFFF",142:"#007CA5",143:"#4F92A5",144:"#005F7F",145:"#3F6F7F",146:"#00394B",147:"#26424B",148:"#001C26",149:"#132126",
  // azure
  150:"#007FFF",151:"#7FBFFF",152:"#0052A5",153:"#4F82A5",154:"#003F7F",155:"#3F5F7F",156:"#00264B",157:"#263B4B",158:"#001326",159:"#131C26",
  // blue-purple
  160:"#003FFF",161:"#7F9FFF",162:"#0029A5",163:"#4F72A5",164:"#001F7F",165:"#3F4F7F",166:"#00134B",167:"#262F4B",168:"#000926",169:"#131726",
  // blue
  170:"#0000FF",171:"#7F7FFF",172:"#0000A5",173:"#4F4FA5",174:"#00007F",175:"#3F3F7F",176:"#00004B",177:"#26264B",178:"#000026",179:"#131326",
  // violet
  180:"#3F00FF",181:"#9F7FFF",182:"#2900A5",183:"#724FA5",184:"#1F007F",185:"#4F3F7F",186:"#13004B",187:"#2F264B",188:"#090026",189:"#171326",
  // purple
  190:"#7F00FF",191:"#BF7FFF",192:"#5200A5",193:"#824FA5",194:"#3F007F",195:"#5F3F7F",196:"#26004B",197:"#3B264B",198:"#130026",199:"#1C1326",
  // magenta-purple
  200:"#BF00FF",201:"#DF7FFF",202:"#7C00A5",203:"#924FA5",204:"#5F007F",205:"#6F3F7F",206:"#39004B",207:"#42264B",208:"#1C0026",209:"#211326",
  // magenta
  210:"#FF00FF",211:"#FF7FFF",212:"#A500A5",213:"#A54FA5",214:"#7F007F",215:"#7F3F7F",216:"#4B004B",217:"#4B264B",218:"#260026",219:"#261326",
  // pink
  220:"#FF00BF",221:"#FF7FDF",222:"#A5007C",223:"#A54F92",224:"#7F005F",225:"#7F3F6F",226:"#4B0039",227:"#4B2642",228:"#26001C",229:"#261321",
  // rose
  230:"#FF007F",231:"#FF7FBF",232:"#A50052",233:"#A54F82",234:"#7F003F",235:"#7F3F5F",236:"#4B0026",237:"#4B263B",238:"#260013",239:"#26131C",
  // crimson
  240:"#FF003F",241:"#FF7F9F",242:"#A50029",243:"#A54F72",244:"#7F001F",245:"#7F3F4F",246:"#4B0013",247:"#4B262F",248:"#260009",249:"#261317",
  // grays
  250:"#333333",251:"#505050",252:"#696969",253:"#828282",254:"#BEBEBE",255:"#E8E8E8",
  256:"#FFFFFF", // BYLAYER sentinel
};

function aciHex(aci: number | undefined | null): string {
  if (aci == null) return "#FFFFFF";
  return ACI_COLORS[aci] ?? "#FFFFFF";
}

// ─── Drawing units ($INSUNITS) ────────────────────────────────────────────────
interface UnitInfo { label: string; toMm: number }
const INSUNITS: Record<number, UnitInfo> = {
  0: { label: "units", toMm: 1 },
  1: { label: "in",    toMm: 25.4 },
  2: { label: "ft",    toMm: 304.8 },
  3: { label: "mi",    toMm: 1_609_344 },
  4: { label: "mm",    toMm: 1 },
  5: { label: "cm",    toMm: 10 },
  6: { label: "m",     toMm: 1000 },
  7: { label: "km",    toMm: 1_000_000 },
  8: { label: "µin",   toMm: 0.0000254 },
  9: { label: "mil",   toMm: 0.0254 },
  10: { label: "yd",   toMm: 914.4 },
  14: { label: "dm",   toMm: 100 },
};

function fmtLength(worldDist: number, unit: UnitInfo, calScale: number): string {
  const mm = worldDist * unit.toMm * calScale;
  if (mm >= 1_000_000) return `${(mm / 1_000_000).toFixed(3)} km`;
  if (mm >= 1000)      return `${(mm / 1000).toFixed(3)} m`;
  if (mm >= 10)        return `${mm.toFixed(1)} mm`;
  return `${mm.toFixed(3)} mm`;
}

function fmtArea(worldArea: number, unit: UnitInfo, calScale: number): string {
  const mm2 = worldArea * unit.toMm * unit.toMm * calScale * calScale;
  if (mm2 >= 1_000_000) return `${(mm2 / 1_000_000).toFixed(3)} m²`;
  if (mm2 >= 10_000)    return `${(mm2 / 10_000).toFixed(2)} cm²`;
  return `${mm2.toFixed(0)} mm²`;
}

function polyArea(pts: THREE.Vector3[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) / 2;
}

function polyCentroid(pts: THREE.Vector3[]): THREE.Vector3 {
  const c = new THREE.Vector3();
  pts.forEach((p) => c.add(p));
  return c.divideScalar(pts.length);
}

// ─── Overlay sprite helpers ───────────────────────────────────────────────────
// Sprites for overlays store their desired PIXEL dimensions in userData.
// The animate loop recomputes world-space scale every frame using:
//   worldUnitsPerPixel = (camera.top - camera.bottom) / (camera.zoom * canvasH)
// This keeps overlays the same screen size regardless of zoom.

const LABEL_PX_H   = 26; // pixels tall for measurement labels
const MARKER_PX    = 14; // pixels diameter for measurement markers

function makeLabelSprite(text: string, bgColor = "rgba(0,8,20,0.88)", fgColor = "#00FF88"): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = "Bold 26px monospace";
  const tw = Math.ceil(ctx.measureText(text).width) + 18;
  const th = 38;
  canvas.width = tw; canvas.height = th;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, tw, th);
  ctx.fillStyle = fgColor;
  ctx.font = "Bold 26px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, tw / 2, th / 2);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false }),
  );
  sprite.userData.pixH = LABEL_PX_H;
  sprite.userData.pixAspect = tw / th;
  return sprite;
}

function makeMarkerSprite(color: string): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(16, 16, 13, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 2.5; ctx.stroke();
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }),
  );
  sprite.userData.pixH = MARKER_PX;
  sprite.userData.pixAspect = 1;
  return sprite;
}

function makeDxfTextSprite(text: string, worldH: number, color: string): THREE.Sprite {
  // DXF text: sized in world units (scales with zoom, like the drawing)
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = "22px Arial";
  const tw = Math.ceil(ctx.measureText(text).width) + 10;
  const th = 32;
  canvas.width = tw; canvas.height = th;
  ctx.fillStyle = color;
  ctx.font = "22px Arial";
  ctx.textBaseline = "bottom";
  ctx.fillText(text, 5, th - 2);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: false, transparent: true }),
  );
  const aspect = tw / th;
  sprite.scale.set(worldH * aspect, worldH, 1);
  // No pixH userData → animate loop leaves it alone (world-space, not screen-stable)
  return sprite;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface CadViewerProps { fileUrl: string }
interface LayerState { name: string; visible: boolean; color: string }
type Mode = "view" | "measure" | "area" | "calibrate";

const DEG = Math.PI / 180;

const CadViewer = ({ fileUrl }: CadViewerProps) => {
  const containerRef   = useRef<HTMLDivElement>(null);
  const rendererRef    = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef       = useRef<THREE.Scene | null>(null);
  const cameraRef      = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef    = useRef<OrbitControls | null>(null);
  const mainGroupRef   = useRef<THREE.Group | null>(null);
  const measureGroupRef= useRef<THREE.Group | null>(null);
  const animFrameRef   = useRef<number | null>(null);

  // Refs for measurement state (avoid stale closure issues in click handler)
  const modeRef        = useRef<Mode>("view");
  const measurePtsRef  = useRef<THREE.Vector3[]>([]);
  const areaPtsRef     = useRef<THREE.Vector3[]>([]);
  const calPtsRef      = useRef<THREE.Vector3[]>([]);
  const calScaleRef    = useRef(1);
  const drawingUnitRef = useRef<UnitInfo>(INSUNITS[0]);

  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [mode,          setMode]          = useState<Mode>("view");
  const [layers,        setLayers]        = useState<LayerState[]>([]);
  const [drawingUnit,   setDrawingUnit]   = useState<UnitInfo>(INSUNITS[0]);
  const [showLayers,    setShowLayers]    = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [areaCount,     setAreaCount]     = useState(0);
  const [calStep,       setCalStep]       = useState(0);

  // Keep modeRef in sync with mode state (avoids stale closures in event handlers)
  const changeMode = useCallback((m: Mode) => {
    modeRef.current = m;
    setMode(m);
  }, []);

  // ── Three.js initialisation ─────────────────────────────────────────────────
  const disposeScene = useCallback(() => {
    if (!sceneRef.current) return;
    sceneRef.current.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m: any) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
    sceneRef.current = null;
  }, []);

  const initThree = useCallback(() => {
    if (!containerRef.current) return;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    disposeScene();
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current.domElement.remove();
    }

    const w = containerRef.current.clientWidth  || 800;
    const h = containerRef.current.clientHeight || 600;
    const aspect = w / h;
    const FS = 1000; // initial frustum height (overridden after DXF loads)

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1117);
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(
      (-FS * aspect) / 2, (FS * aspect) / 2, FS / 2, -FS / 2, 0.1, 1e9,
    );
    camera.position.set(0, 0, 1e6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.screenSpacePanning = true;
    controls.zoomSpeed = 1.2;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN,
    };
    controlsRef.current = controls;

    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measureGroupRef.current = measureGroup;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();

      // Keep overlay sprites at constant SCREEN pixel size.
      // OrbitControls zoom changes camera.zoom, NOT camera.top/bottom.
      const cam = cameraRef.current;
      const cont = containerRef.current;
      if (cam && cont && measureGroupRef.current) {
        const ch = cont.clientHeight || 600;
        // world units per pixel on screen (accounts for camera.zoom)
        const wpp = (cam.top - cam.bottom) / (cam.zoom * ch);
        measureGroupRef.current.traverse((obj) => {
          if (obj instanceof THREE.Sprite && obj.userData.pixH) {
            const ph: number = obj.userData.pixH;
            const pa: number = obj.userData.pixAspect ?? 1;
            obj.scale.set(ph * pa * wpp, ph * wpp, 1);
          }
        });
      }

      renderer.render(scene, camera);
    };
    animate();
  }, [disposeScene]);

  // ── DXF parsing ─────────────────────────────────────────────────────────────
  const loadDxf = useCallback(async () => {
    if (!sceneRef.current) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();

      const parser = new DxfParser();
      const dxf = parser.parseSync(text);
      if (!dxf) throw new Error("Parser returned null");

      // Remove previous geometry
      if (mainGroupRef.current) {
        sceneRef.current.remove(mainGroupRef.current);
        mainGroupRef.current = null;
      }

      // Drawing units
      const insUnits: number = (dxf.header as any)?.$INSUNITS ?? 0;
      const unit = INSUNITS[insUnits] ?? INSUNITS[0];
      setDrawingUnit(unit);
      drawingUnitRef.current = unit;
      calScaleRef.current = 1;

      // Layer lookup
      const rawLayers: Record<string, any> = dxf.tables?.layer?.layers ?? {};
      const mainGroup = new THREE.Group();
      mainGroupRef.current = mainGroup;
      const layersMap = new Map<string, THREE.Group>();
      const layersList: LayerState[] = [];

      Object.values(rawLayers).forEach((lyr: any) => {
        const grp = new THREE.Group();
        grp.name = lyr.name;
        mainGroup.add(grp);
        layersMap.set(lyr.name, grp);
        layersList.push({
          name: lyr.name,
          visible: true,
          color: aciHex(lyr.colorIndex ?? lyr.color),
        });
      });

      const getLayer = (name: string): THREE.Group => {
        let g = layersMap.get(name);
        if (!g) {
          g = new THREE.Group();
          g.name = name;
          mainGroup.add(g);
          layersMap.set(name, g);
          if (!layersList.find((l) => l.name === name))
            layersList.push({ name, visible: true, color: "#FFFFFF" });
        }
        return g;
      };

      const resolveColor = (ent: any): string => {
        const aci: number | undefined = ent.colorIndex ?? ent.color;
        if (aci == null || aci === 256) {
          const lyr = rawLayers[ent.layer ?? "0"];
          return aciHex(lyr?.colorIndex ?? lyr?.color ?? 7);
        }
        return aciHex(aci);
      };

      // Recursive entity renderer (handles INSERT block references)
      const renderEnt = (ent: any, parentGrp: THREE.Group) => {
        const hex = resolveColor(ent);
        const lmat = new THREE.LineBasicMaterial({ color: hex });

        switch (ent.type) {
          case "LINE": {
            if (!ent.vertices?.length) break;
            const g = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(ent.vertices[0].x, ent.vertices[0].y, 0),
              new THREE.Vector3(ent.vertices[1].x, ent.vertices[1].y, 0),
            ]);
            parentGrp.add(new THREE.Line(g, lmat));
            break;
          }
          case "LWPOLYLINE":
          case "POLYLINE": {
            if (!ent.vertices?.length) break;
            const pts = ent.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, 0));
            if (ent.closed) pts.push(pts[0].clone());
            parentGrp.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(pts), lmat,
            ));
            break;
          }
          case "CIRCLE": {
            // Use EllipseCurve, NOT CircleGeometry+EdgesGeometry (that adds spokes)
            const c = new THREE.EllipseCurve(
              ent.center.x, ent.center.y,
              ent.radius, ent.radius,
              0, Math.PI * 2, false, 0,
            );
            parentGrp.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(c.getPoints(72)), lmat,
            ));
            break;
          }
          case "ARC": {
            // dxf-parser returns angles in DEGREES; EllipseCurve wants RADIANS
            let sa = (ent.startAngle ?? 0) * DEG;
            let ea = (ent.endAngle   ?? 360) * DEG;
            if (ea < sa) ea += Math.PI * 2; // handle wrap-around
            const c = new THREE.EllipseCurve(
              ent.center.x, ent.center.y,
              ent.radius, ent.radius,
              sa, ea, false, 0,
            );
            parentGrp.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(c.getPoints(Math.max(32, Math.ceil((ea - sa) / DEG)))), lmat,
            ));
            break;
          }
          case "ELLIPSE": {
            const mx = ent.majorAxisEndPoint?.x ?? 1;
            const my = ent.majorAxisEndPoint?.y ?? 0;
            const rx = Math.sqrt(mx * mx + my * my);
            const ry = rx * (ent.axisRatio ?? 1);
            const rot = Math.atan2(my, mx);
            const c = new THREE.EllipseCurve(
              ent.center.x, ent.center.y,
              rx, ry,
              ent.startAngle ?? 0,
              ent.endAngle   ?? Math.PI * 2,
              false, rot,
            );
            parentGrp.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(c.getPoints(72)), lmat,
            ));
            break;
          }
          case "SPLINE": {
            const cp = (ent.controlPoints ?? ent.fitPoints ?? []);
            if (cp.length < 2) break;
            const pts = cp.map((p: any) => new THREE.Vector3(p.x, p.y, 0));
            const curve = new THREE.CatmullRomCurve3(pts);
            parentGrp.add(new THREE.Line(
              new THREE.BufferGeometry().setFromPoints(curve.getPoints(pts.length * 10)), lmat,
            ));
            break;
          }
          case "TEXT":
          case "MTEXT": {
            const txt = ent.text ?? ent.string ?? "";
            if (!txt.trim()) break;
            const pos = ent.startPoint ?? ent.position ?? ent.insertionPoint;
            if (!pos) break;
            const h = ent.textHeight ?? ent.height ?? 2.5;
            const s = makeDxfTextSprite(txt, h, hex);
            s.position.set(pos.x, pos.y, 1);
            parentGrp.add(s);
            break;
          }
          case "INSERT": {
            const block = (dxf as any).blocks?.[ent.name];
            if (!block?.entities?.length) break;
            const bg = new THREE.Group();
            bg.position.set(ent.position?.x ?? 0, ent.position?.y ?? 0, 0);
            bg.scale.set(ent.xScale ?? 1, ent.yScale ?? 1, 1);
            bg.rotation.z = (ent.rotation ?? 0) * DEG;
            block.entities.forEach((sub: any) => renderEnt(sub, bg));
            parentGrp.add(bg);
            return; // already added
          }
          case "HATCH": {
            // Semi-transparent fill
            const fm = new THREE.MeshBasicMaterial({
              color: hex, transparent: true, opacity: 0.10, side: THREE.DoubleSide,
            });
            (ent.boundaryPaths ?? []).forEach((path: any) => {
              const verts: THREE.Vector2[] = [];
              (path.edges ?? []).forEach((e: any) => {
                if (e.startPoint) verts.push(new THREE.Vector2(e.startPoint.x, e.startPoint.y));
                else if (e.start)  verts.push(new THREE.Vector2(e.start.x, e.start.y));
              });
              if (verts.length === 0 && path.vertices) {
                path.vertices.forEach((v: any) => verts.push(new THREE.Vector2(v.x, v.y)));
              }
              if (verts.length < 3) return;
              try {
                const mesh = new THREE.Mesh(
                  new THREE.ShapeGeometry(new THREE.Shape(verts)),
                  fm.clone(),
                );
                parentGrp.add(mesh);
              } catch (_) {}
            });
            break;
          }
          default: break;
        }
      };

      (dxf.entities ?? []).forEach((ent: any) => {
        renderEnt(ent, getLayer(ent.layer ?? "0"));
      });

      sceneRef.current?.add(mainGroup);
      setLayers(layersList.sort((a, b) => a.name.localeCompare(b.name)));

      // Fit camera to drawing extents
      const box = new THREE.Box3().setFromObject(mainGroup);
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size   = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, 1);
        const cam    = cameraRef.current!;
        const cont   = containerRef.current!;
        const aspect = cont.clientWidth / cont.clientHeight;
        const pad    = 1.05;
        cam.left   = (-maxDim * aspect * pad) / 2;
        cam.right  = ( maxDim * aspect * pad) / 2;
        cam.top    = ( maxDim * pad) / 2;
        cam.bottom = (-maxDim * pad) / 2;
        cam.zoom   = 1;
        cam.position.set(center.x, center.y, 1e6);
        controlsRef.current!.target.set(center.x, center.y, 0);
        cam.updateProjectionMatrix();
        controlsRef.current!.update();
      }

      setLoading(false);
    } catch (e: any) {
      console.error("DXF load error:", e);
      setError(e.message ?? "Failed to parse DXF");
      setLoading(false);
    }
  }, [fileUrl]);

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  useEffect(() => {
    initThree();
    loadDxf();

    const onResize = () => {
      const cam = cameraRef.current;
      const rend = rendererRef.current;
      const cont = containerRef.current;
      if (!cam || !rend || !cont) return;
      const w = cont.clientWidth;
      const h = cont.clientHeight;
      const aspect = w / h;
      const viewH = cam.top - cam.bottom;
      cam.left   = (-viewH * aspect) / 2;
      cam.right  = ( viewH * aspect) / 2;
      cam.updateProjectionMatrix();
      rend.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      disposeScene();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current.domElement.remove();
      }
    };
  }, [fileUrl]);

  // ── Layer toggle ────────────────────────────────────────────────────────────
  const toggleLayer = (name: string) => {
    setLayers((prev) =>
      prev.map((l) => {
        if (l.name !== name) return l;
        const v = !l.visible;
        const g = mainGroupRef.current?.children.find((c) => c.name === name);
        if (g) g.visible = v;
        return { ...l, visible: v };
      }),
    );
  };

  // ── Measurement helpers ─────────────────────────────────────────────────────
  const addOverlay = (obj: THREE.Object3D, pos: THREE.Vector3, z = 2) => {
    obj.position.copy(pos);
    obj.position.z = z;
    measureGroupRef.current?.add(obj);
  };

  const addLineSeg = (a: THREE.Vector3, b: THREE.Vector3, color: number) => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a, b]),
      new THREE.LineBasicMaterial({ color, depthTest: false }),
    );
    measureGroupRef.current?.add(line);
  };

  const clearMeasurements = () => {
    const mg = measureGroupRef.current;
    if (mg) {
      while (mg.children.length) {
        const ch = mg.children[0] as any;
        if (ch.geometry) ch.geometry.dispose();
        if (ch.material) { if (ch.material.map) ch.material.map.dispose(); ch.material.dispose(); }
        mg.remove(ch);
      }
    }
    measurePtsRef.current = [];
    areaPtsRef.current    = [];
    calPtsRef.current     = [];
    setAreaCount(0);
    setCalStep(0);
  };

  // ── Canvas interaction ──────────────────────────────────────────────────────
  const getWorldPoint = (e: React.MouseEvent): THREE.Vector3 | null => {
    if (!cameraRef.current || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left)  / rect.width)  *  2 - 1;
    const y = ((e.clientY - rect.top)   / rect.height) * -2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), target);
    return target;
  };

  const handleClick = (e: React.MouseEvent) => {
    const m = modeRef.current;
    if (m === "view") return;
    const pt = getWorldPoint(e);
    if (!pt) return;

    if (m === "calibrate") {
      const pts = [...calPtsRef.current, pt];
      calPtsRef.current = pts;
      addOverlay(makeMarkerSprite("#FFAA00"), pt);
      if (pts.length === 2) {
        addLineSeg(pts[0], pts[1], 0xffaa00);
        const dist = pts[0].distanceTo(pts[1]);
        const input = prompt("Enter the real distance between these two points (in drawing units):");
        if (input && !isNaN(parseFloat(input))) {
          const real = parseFloat(input);
          calScaleRef.current = real / dist;
          alert(`Scale set: 1 world unit = ${calScaleRef.current.toFixed(6)} drawing units`);
        }
        calPtsRef.current = [];
        setCalStep(0);
        changeMode("view");
      } else {
        setCalStep(1);
      }
      return;
    }

    if (m === "measure") {
      const pts = [...measurePtsRef.current, pt];
      measurePtsRef.current = pts;
      addOverlay(makeMarkerSprite("#00FF88"), pt);
      if (pts.length === 2) {
        addLineSeg(pts[0], pts[1], 0x00ff88);
        const d = pts[0].distanceTo(pts[1]);
        const label = fmtLength(d, drawingUnitRef.current, calScaleRef.current);
        const mid = pts[0].clone().lerp(pts[1], 0.5);
        addOverlay(makeLabelSprite(label), mid, 3);
        measurePtsRef.current = [];
      }
      return;
    }

    if (m === "area") {
      const pts = [...areaPtsRef.current, pt];
      areaPtsRef.current = pts;
      addOverlay(makeMarkerSprite("#4488FF"), pt);
      if (pts.length > 1) addLineSeg(pts[pts.length - 2], pt, 0x4488ff);
      setAreaCount(pts.length);
    }
  };

  const handleDblClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (modeRef.current !== "area") return;
    const pts = areaPtsRef.current;
    if (pts.length < 3) { areaPtsRef.current = []; setAreaCount(0); return; }

    // Close polygon
    addLineSeg(pts[pts.length - 1], pts[0], 0x4488ff);

    // Filled area
    try {
      const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthTest: false }),
      );
      mesh.position.z = 1;
      measureGroupRef.current?.add(mesh);
    } catch (_) {}

    const area = polyArea(pts);
    const label = fmtArea(area, drawingUnitRef.current, calScaleRef.current);
    addOverlay(makeLabelSprite(label, "rgba(0,4,30,0.88)", "#88CCFF"), polyCentroid(pts), 3);
    areaPtsRef.current = [];
    setAreaCount(0);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const unitLabel = drawingUnit.label === "units"
    ? "Unitless" : drawingUnit.label;

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10">
        <div className="bg-gray-900/92 backdrop-blur rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 border border-white/10">
          <ToolBtn icon={<MousePointer2 size={17}/>} active={mode==="view"}      onClick={() => changeMode("view")}      title="Pan / Zoom" />
          <ToolBtn icon={<Ruler size={17}/>}         active={mode==="measure"}   onClick={() => changeMode("measure")}   title="Measure Length" />
          <ToolBtn icon={<Square size={17}/>}        active={mode==="area"}      onClick={() => changeMode("area")}      title="Measure Area (dbl-click to close)" />
          {drawingUnit.label === "units" && (
            <ToolBtn icon={<Settings2 size={17}/>}   active={mode==="calibrate"} onClick={() => changeMode("calibrate")} title="Calibrate Scale" />
          )}
          <Divider />
          <ToolBtn icon={<Trash2 size={17}/>} onClick={clearMeasurements} title="Clear All Measurements" />
          <Divider />
          <ToolBtn icon={<Layers size={17}/>}    active={showLayers}    onClick={() => setShowLayers(v => !v)} title="Layers" />
          <ToolBtn icon={<Crosshair size={17}/>} active={showCrosshair} onClick={() => setShowCrosshair(v => !v)} title="Crosshair" />
          <ToolBtn icon={<RefreshCw size={17}/>} onClick={() => { clearMeasurements(); initThree(); loadDxf(); }} title="Reload" />
        </div>
      </div>

      {/* Layer panel */}
      {showLayers && (
        <div className="absolute top-3 left-16 z-20 w-60 max-h-[78%] bg-gray-900/96 backdrop-blur rounded-xl shadow-2xl border border-white/10 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10 text-xs font-bold text-gray-400 uppercase tracking-wider">
            Layers ({layers.length})
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {layers.map((l) => (
              <div key={l.name}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer"
                onClick={() => toggleLayer(l.name)}
              >
                <div className={`w-3.5 h-3.5 rounded-sm flex-shrink-0 border border-white/20 ${!l.visible ? "opacity-20" : ""}`}
                  style={{ backgroundColor: l.color }} />
                <span className={`text-xs truncate flex-1 ${l.visible ? "text-gray-200" : "text-gray-600 line-through"}`}>
                  {l.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode banners */}
      {mode === "measure" && (
        <Banner color="bg-emerald-800" icon={<Ruler size={14}/>} title="Measure Length" hint="Click two points" />
      )}
      {mode === "area" && (
        <Banner color="bg-blue-900" icon={<Square size={14}/>} title="Measure Area"
          hint={areaCount === 0 ? "Click polygon vertices" : `${areaCount} pts — double-click to close`} />
      )}
      {mode === "calibrate" && (
        <Banner color="bg-amber-800" icon={<Settings2 size={14}/>} title="Calibrate Scale"
          hint={calStep === 0 ? "Click start of known distance" : "Click end point"} />
      )}

      {/* Status bar */}
      <div className="absolute bottom-3 right-3 z-10 text-[10px] text-gray-500 font-mono bg-black/60 px-2.5 py-1 rounded-lg flex items-center gap-3 select-none">
        <span>Unit: <span className="text-gray-300">{unitLabel}</span></span>
        {drawingUnit.toMm !== 1 && drawingUnit.label !== "units" && (
          <span>1 unit = <span className="text-gray-300">{drawingUnit.toMm} mm</span></span>
        )}
      </div>

      {/* Crosshair */}
      {showCrosshair && (
        <>
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5 pointer-events-none" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 pointer-events-none" />
        </>
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0d1117]/90 backdrop-blur-sm">
          <Loader2 className="animate-spin text-blue-400 mb-3" size={48} />
          <span className="text-gray-500 text-xs uppercase tracking-widest font-medium">Parsing drawing…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="bg-gray-900 border border-red-800 rounded-2xl p-6 max-w-sm text-center shadow-2xl">
            <p className="text-red-400 font-bold mb-1">Viewer Error</p>
            <p className="text-gray-500 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`w-full h-full ${mode === "view" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
        onClick={handleClick}
        onDoubleClick={handleDblClick}
      />
    </div>
  );
};

// ─── Small UI helpers ──────────────────────────────────────────────────────────
const ToolBtn = ({ icon, active, onClick, title }: {
  icon: React.ReactNode; active?: boolean; onClick: () => void; title: string;
}) => (
  <button onClick={onClick} title={title}
    className={`p-2 rounded-lg transition-all ${active
      ? "bg-blue-600 text-white shadow"
      : "text-gray-500 hover:bg-white/8 hover:text-gray-200"
    }`}
  >
    {icon}
  </button>
);

const Divider = () => <div className="h-px bg-white/10 mx-1 my-0.5" />;

const Banner = ({ color, icon, title, hint }: {
  color: string; icon: React.ReactNode; title: string; hint: string;
}) => (
  <div className={`absolute bottom-10 left-1/2 -translate-x-1/2 z-20 ${color} text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2.5 text-sm select-none`}>
    {icon}
    <span className="font-semibold">{title}</span>
    <span className="border-l border-white/25 pl-2.5 opacity-80 text-xs">{hint}</span>
  </div>
);

export default CadViewer;
