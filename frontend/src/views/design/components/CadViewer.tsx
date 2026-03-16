import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import DxfParser from "dxf-parser";
import {
  MousePointer2,
  Ruler,
  Loader2,
  RefreshCw,
  Layers,
  Crosshair,
  Settings2,
} from "lucide-react";

interface CadViewerProps {
  fileUrl: string;
}

interface LayerState {
  name: string;
  visible: boolean;
  color: string;
}

const CadViewer = ({ fileUrl }: CadViewerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const mainGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "measure" | "calibrate">("view");
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
  const [layers, setLayers] = useState<LayerState[]>([]);
  const [scale, setScale] = useState(1.0); // 1 world unit = 1 real unit by default
  const [showLayers, setShowLayers] = useState(false);
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [calibratingPoints, setCalibratingPoints] = useState<THREE.Vector3[]>(
    [],
  );

  useEffect(() => {
    if (!fileUrl) return;
    initThree();
    loadDxf();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current)
        return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      const aspect = width / height;
      const frustumSize = cameraRef.current.top - cameraRef.current.bottom;
      cameraRef.current.left = (-frustumSize * aspect) / 2;
      cameraRef.current.right = (frustumSize * aspect) / 2;
      cameraRef.current.top = frustumSize / 2;
      cameraRef.current.bottom = -frustumSize / 2;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      disposeScene();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current.domElement.remove();
      }
    };
  }, [fileUrl]);

  const disposeScene = () => {
    if (!sceneRef.current) return;
    sceneRef.current.traverse((object: any) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material: any) => {
            if (material.map) material.map.dispose();
            material.dispose();
          });
        } else {
          if (object.material.map) object.material.map.dispose();
          object.material.dispose();
        }
      }
    });
    sceneRef.current = null;
  };

  const initThree = () => {
    if (!containerRef.current) return;

    // Clean up previous state
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    disposeScene();
    if (rendererRef.current) {
      rendererRef.current.dispose();
      rendererRef.current.domElement.remove();
    }

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    sceneRef.current = scene;

    const aspect = width / height;
    const frustumSize = 1000;
    const camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      20000,
    );
    camera.position.set(0, 0, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controlsRef.current = controls;

    const animate = () => {
      animationFrameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
  };

  const loadDxf = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(fileUrl);
      const text = await response.text();
      const parser = new DxfParser();
      const dxf = parser.parseSync(text);

      if (!dxf) throw new Error("Failed to parse DXF");

      const mainGroup = new THREE.Group();
      mainGroupRef.current = mainGroup;

      const layersMap = new Map<string, THREE.Group>();
      const layersList: LayerState[] = [];

      // Initialize layers from DXF tables
      if (dxf.tables && dxf.tables.layer) {
        Object.values(dxf.tables.layer.layers).forEach((layer: any) => {
          const layerGroup = new THREE.Group();
          layerGroup.name = layer.name;
          mainGroup.add(layerGroup);
          layersMap.set(layer.name, layerGroup);
          layersList.push({
            name: layer.name,
            visible: true,
            color: layer.color
              ? `#${layer.color.toString(16).padStart(6, "0")}`
              : "#ffffff",
          });
        });
      }

      const getLayerGroup = (name: string) => {
        let group = layersMap.get(name);
        if (!group) {
          group = new THREE.Group();
          group.name = name;
          mainGroup.add(group);
          layersMap.set(name, group);
          if (!layersList.find((l) => l.name === name)) {
            layersList.push({ name, visible: true, color: "#ffffff" });
          }
        }
        return group;
      };

      const addEntity = (entity: any, mesh: THREE.Object3D) => {
        const group = getLayerGroup(entity.layer || "0");
        group.add(mesh);
      };

      if (dxf.entities) {
        dxf.entities.forEach((entity: any) => {
          const color = entity.color
            ? `#${entity.color.toString(16).padStart(6, "0")}`
            : "#ffffff";
          const material = new THREE.LineBasicMaterial({ color });

          if (entity.type === "LINE") {
            const geometry = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(entity.vertices[0].x, entity.vertices[0].y, 0),
              new THREE.Vector3(entity.vertices[1].x, entity.vertices[1].y, 0),
            ]);
            addEntity(entity, new THREE.Line(geometry, material));
          } else if (
            entity.type === "LWPOLYLINE" ||
            entity.type === "POLYLINE"
          ) {
            const points = entity.vertices.map(
              (v: any) => new THREE.Vector3(v.x, v.y, 0),
            );
            if (entity.closed) points.push(points[0]);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            addEntity(entity, new THREE.Line(geometry, material));
          } else if (entity.type === "CIRCLE") {
            const geometry = new THREE.CircleGeometry(entity.radius, 64);
            const edges = new THREE.EdgesGeometry(geometry);
            const circle = new THREE.LineSegments(edges, material);
            circle.position.set(entity.center.x, entity.center.y, 0);
            addEntity(entity, circle);
          } else if (entity.type === "ARC") {
            const curve = new THREE.EllipseCurve(
              entity.center.x,
              entity.center.y,
              entity.radius,
              entity.radius,
              entity.startAngle,
              entity.endAngle,
              false,
              0,
            );
            const geometry = new THREE.BufferGeometry().setFromPoints(
              curve.getPoints(50),
            );
            addEntity(entity, new THREE.Line(geometry, material));
          }
        });
      }

      sceneRef.current?.add(mainGroup);
      setLayers(layersList.sort((a, b) => a.name.localeCompare(b.name)));

      const box = new THREE.Box3().setFromObject(mainGroup);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y);

      if (cameraRef.current && controlsRef.current) {
        const fov = 1.1;
        cameraRef.current.left = (-maxDim * fov) / 2;
        cameraRef.current.right = (maxDim * fov) / 2;
        cameraRef.current.top = (maxDim * fov) / 2;
        cameraRef.current.bottom = (-maxDim * fov) / 2;
        cameraRef.current.position.set(center.x, center.y, 1000);
        controlsRef.current.target.set(center.x, center.y, 0);
        cameraRef.current.updateProjectionMatrix();
        controlsRef.current.update();
      }

      setLoading(false);
    } catch (e: any) {
      console.error("DXF Load Error", e);
      setError("Failed to load or parse DXF file.");
      setLoading(false);
    }
  };

  const toggleLayer = (layerName: string) => {
    setLayers((prev: LayerState[]) =>
      prev.map((l) => {
        if (l.name === layerName) {
          const newVisible = !l.visible;
          const group = mainGroupRef.current?.children.find(
            (c) => c.name === layerName,
          );
          if (group) group.visible = newVisible;
          return { ...l, visible: newVisible };
        }
        return l;
      }),
    );
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;
    if (mode === "view") return;

    const rect = containerRef.current!.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const mouse = new THREE.Vector2(x, y);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
      target,
    );

    if (mode === "calibrate") {
      const pts = [...calibratingPoints, target];
      setCalibratingPoints(pts);
      addMarker(target, 0xffaa00);
      if (pts.length === 2) {
        // Show prompt for distance
        const input = prompt(
          "Enter the actual distance between these two points:",
        );
        if (input && !isNaN(parseFloat(input))) {
          const actualDist = parseFloat(input);
          const worldDist = pts[0].distanceTo(pts[1]);
          setScale(actualDist / worldDist);
          alert(
            `Scale set: 1 unit = ${(actualDist / worldDist).toFixed(4)} real units`,
          );
        }
        setCalibratingPoints([]);
        setMode("view");
      }
    } else if (mode === "measure") {
      const pts = [...measurePoints, target];
      setMeasurePoints(pts);
      addMarker(target, 0x00ff00);
      if (pts.length === 2) {
        const distance = pts[0].distanceTo(pts[1]) * scale;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([
          pts[0],
          pts[1],
        ]);
        const line = new THREE.Line(
          lineGeo,
          new THREE.LineBasicMaterial({ color: 0x00ff00 }),
        );
        sceneRef.current.add(line);
        const zoom = (cameraRef.current.top - cameraRef.current.bottom) / 1000;
        sceneRef.current.add(
          createTextLabel(
            `${distance.toFixed(3)}`,
            pts[0].clone().lerp(pts[1], 0.5),
            zoom * 25,
          ),
        );
        setMeasurePoints([]);
      }
    }
  };

  const addMarker = (position: THREE.Vector3, color: number) => {
    const zoom = (cameraRef.current!.top - cameraRef.current!.bottom) / 1000;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(1, 8, 8),
      new THREE.MeshBasicMaterial({ color }),
    );
    marker.scale.set(zoom * 5, zoom * 5, zoom * 5);
    marker.position.copy(position);
    sceneRef.current?.add(marker);
  };

  const createTextLabel = (
    text: string,
    position: THREE.Vector3,
    scale: number,
  ) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    context.font = "Bold 48px Arial";
    const w = context.measureText(text).width + 40;
    canvas.width = w;
    canvas.height = 70;
    context.fillStyle = "rgba(0,0,0,0.8)";
    context.fillRect(0, 0, w, 70);
    context.fillStyle = "white";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "Bold 48px Arial";
    context.fillText(text, w / 2, 35);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    sprite.scale.set(scale * (w / 70), scale, 1);
    sprite.position.copy(position);
    return sprite;
  };

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden bg-[#1a1a1a]">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-surface-card/90 backdrop-blur rounded-lg shadow-xl p-1 flex flex-col gap-1 border border-white/20">
          <ToolbarButton
            icon={<MousePointer2 size={18} />}
            active={mode === "view"}
            onClick={() => setMode("view")}
            title="Pan Mode"
          />
          <ToolbarButton
            icon={<Ruler size={18} />}
            active={mode === "measure"}
            onClick={() => setMode("measure")}
            title="Measure"
          />
          <ToolbarButton
            icon={<Settings2 size={18} />}
            active={mode === "calibrate"}
            onClick={() => setMode("calibrate")}
            title="Calibrate Scale"
          />
          <div className="h-px bg-gray-200 mx-1 my-0.5" />
          <ToolbarButton
            icon={<Layers size={18} />}
            active={showLayers}
            onClick={() => setShowLayers(!showLayers)}
            title="Layers"
          />
          <ToolbarButton
            icon={<Crosshair size={18} />}
            active={showCrosshair}
            onClick={() => setShowCrosshair(!showCrosshair)}
            title="Toggle Crosshair"
          />
          <ToolbarButton
            icon={<RefreshCw size={18} />}
            onClick={() => {
              initThree();
              loadDxf();
            }}
            title="Reload"
          />
        </div>
      </div>

      {/* Layer Sidebar */}
      {showLayers && (
        <div className="absolute top-4 left-16 z-20 w-64 max-h-[80%] bg-surface-card/95 backdrop-blur rounded-lg shadow-2xl border border-border-default overflow-hidden flex flex-col animate-in slide-in-from-left duration-200">
          <div className="p-3 border-b bg-surface-base flex justify-between items-center">
            <span className="font-bold text-text-secondary">
              Layers ({layers.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {layers.map((layer) => (
              <div
                key={layer.name}
                className="flex items-center gap-2 p-1.5 hover:bg-surface-raised rounded cursor-pointer transition-colors"
                onClick={() => toggleLayer(layer.name)}
              >
                <div
                  className={`w-4 h-4 rounded-sm border ${layer.visible ? "shadow-inner" : "opacity-20"}`}
                  style={{ backgroundColor: layer.color }}
                />
                <span
                  className={`text-sm truncate flex-1 ${layer.visible ? "text-gray-800" : "text-text-disabled line-through"}`}
                >
                  {layer.name}
                </span>
                <input
                  type="checkbox"
                  checked={layer.visible}
                  readOnly
                  className="rounded text-primary focus:ring-0"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calibration Overlay */}
      {mode === "calibrate" && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 bg-amber-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
          <span className="font-bold">Scale Calibration Mode</span>
          <span className="text-sm border-l border-white/30 pl-3">
            {calibratingPoints.length === 0
              ? "Click start point of a known distance"
              : "Click end point"}
          </span>
        </div>
      )}

      {/* Viewport Info */}
      <div className="absolute bottom-4 right-4 z-10 text-[10px] text-text-disabled font-mono bg-black/40 px-2 py-1 rounded">
        Scale: 1 unit = {scale.toFixed(4)} units
      </div>

      {/* Crosshair */}
      {showCrosshair && (
        <>
          <div className="absolute inset-0 pointer-events-none border-t border-white/5 top-1/2 w-full" />
          <div className="absolute inset-0 pointer-events-none border-l border-white/5 left-1/2 h-full" />
        </>
      )}

      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a1a]/80 z-50 backdrop-blur-sm">
          <div className="relative">
            <Loader2 className="animate-spin text-primary" size={60} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
            </div>
          </div>
          <span className="mt-4 text-gray-300 font-medium tracking-widest text-xs uppercase">
            Rendering DXF Pipeline
          </span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/10 z-50">
          <div className="bg-surface-card p-6 rounded-xl shadow-2xl max-w-sm text-center border-t-4 border-error">
            <h4 className="text-error font-bold mb-2">Engine Error</h4>
            <p className="text-text-secondary text-sm">{error}</p>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className={`w-full h-full bg-[#1a1a1a] ${mode === "view" ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair"}`}
        onClick={handleCanvasClick}
      />
    </div>
  );
};

const ToolbarButton = ({ icon, active, onClick, title }: any) => (
  <button
    onClick={onClick}
    className={`p-2.5 rounded-md transition-all ${active ? "bg-primary text-white shadow-lg" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"}`}
    title={title}
  >
    {icon}
  </button>
);

export default CadViewer;
