import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Home,
  Layers,
  ListChecks,
  LogOut,
  MapPin,
  Paperclip,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Smartphone,
  Star,
  User,
  X,
} from "lucide-react";
import api from "../api/axios";
import { getPublicFileUrl } from "../api/baseUrl";
import { PermissionCode } from "../config/permissions";
import { useAuth } from "../context/AuthContext";
import { qualityService } from "../services/quality.service";
import "./styles/mobile.css";

type EpsNode = {
  id: number;
  name: string;
  type: string;
  parentId: number | null;
};

type AnyRecord = Record<string, any>;

type ActivityOption = {
  id: number;
  name: string;
  listName: string;
  listId: number;
  description?: string;
  applicabilityLevel?: string;
  requiresPourCard?: boolean;
  requiresPourClearanceCard?: boolean;
};

type ActivityListOption = {
  id: number;
  name: string;
  description?: string;
  activities: ActivityOption[];
};

const dateText = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "Not available";

const pickName = (value: AnyRecord | null | undefined) =>
  value?.displayName || value?.name || value?.username || value?.fullName || "Not available";

const statusChipClass = (status?: string) => {
  const normalized = String(status || "").toUpperCase();
  if (["REJECTED", "FAILED", "CRITICAL", "OPEN"].includes(normalized)) {
    return "mobile-chip danger";
  }
  if (["PENDING", "IN_PROGRESS", "SUBMITTED", "RAISED"].some((s) => normalized.includes(s))) {
    return "mobile-chip warn";
  }
  return "mobile-chip";
};

const hasAnyPermission = (
  hasPermission: (permission: string) => boolean,
  permissions: string[],
) => permissions.some((permission) => hasPermission(permission));

type MobileTheme = "light" | "dark" | "contrast";
type MobileSiteMode = "normal" | "large";

const MOBILE_SETTINGS_EVENT = "setu-mobile-settings";
const MOBILE_RECENT_RFI_KEY = "setu-mobile-recent-rfis";

const readStorageJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorageJson = (key: string, value: unknown) => {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(MOBILE_SETTINGS_EVENT));
};

function useStoredMobileSetting<T extends string>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return fallback;
    return (window.localStorage.getItem(key) as T) || fallback;
  });

  useEffect(() => {
    const sync = () => setValue(((window.localStorage.getItem(key) as T) || fallback));
    window.addEventListener("storage", sync);
    window.addEventListener(MOBILE_SETTINGS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(MOBILE_SETTINGS_EVENT, sync);
    };
  }, [fallback, key]);

  const update = (next: T) => {
    window.localStorage.setItem(key, next);
    setValue(next);
    window.dispatchEvent(new Event(MOBILE_SETTINGS_EVENT));
  };

  return [value, update] as const;
}

const favoriteLocationKey = (projectId?: string) => `setu-mobile-favorite-locations-${projectId || "global"}`;

function useFavoriteLocations(projectId?: string) {
  const key = favoriteLocationKey(projectId);
  const [ids, setIds] = useState<number[]>(() => readStorageJson<number[]>(key, []));

  useEffect(() => {
    setIds(readStorageJson<number[]>(key, []));
    const sync = () => setIds(readStorageJson<number[]>(key, []));
    window.addEventListener("storage", sync);
    window.addEventListener(MOBILE_SETTINGS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(MOBILE_SETTINGS_EVENT, sync);
    };
  }, [key]);

  const toggle = (id: number) => {
    const next = ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
    setIds(next);
    writeStorageJson(key, next);
  };

  return { favoriteIds: ids, toggleFavorite: toggle };
}

const rememberRecentInspection = (item: AnyRecord, projectId?: string) => {
  if (!item?.id || !projectId) return;
  const current = readStorageJson<AnyRecord[]>(MOBILE_RECENT_RFI_KEY, []);
  const nextItem = {
    id: item.id,
    projectId,
    title: item.rfiNumber || `RFI #${item.id}`,
    subtitle: `${item.activityName || item.checklistName || "Checklist"} / ${item.goLabel || item.goName || "GO"}`,
    status: item.status || item.workflowStatus || "RFI",
    location: item.elementName || item.epsNodeLabel || item.locationDisplay || "",
    at: new Date().toISOString(),
  };
  writeStorageJson(
    MOBILE_RECENT_RFI_KEY,
    [nextItem, ...current.filter((row) => !(String(row.id) === String(item.id) && String(row.projectId) === String(projectId)))].slice(0, 10),
  );
};

function useRecentInspections(projectId?: string) {
  const [items, setItems] = useState<AnyRecord[]>(() =>
    readStorageJson<AnyRecord[]>(MOBILE_RECENT_RFI_KEY, []).filter((row) => String(row.projectId) === String(projectId)),
  );
  useEffect(() => {
    const sync = () =>
      setItems(readStorageJson<AnyRecord[]>(MOBILE_RECENT_RFI_KEY, []).filter((row) => String(row.projectId) === String(projectId)));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(MOBILE_SETTINGS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(MOBILE_SETTINGS_EVENT, sync);
    };
  }, [projectId]);
  return items;
}

const uploadMobileFiles = async (files: FileList | File[]): Promise<string[]> => {
  const rows = Array.from(files || []);
  const uploaded: string[] = [];
  for (const file of rows) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const url = response.data?.url || response.data?.path || response.data?.fileUrl;
    if (url) uploaded.push(url);
  }
  return uploaded;
};

const evidencePhotos = (item: AnyRecord | null | undefined) =>
  [
    ...((item?.photos as string[]) || []),
    ...((item?.photoUrls as string[]) || []),
    ...((item?.rectificationPhotos as string[]) || []),
    ...((item?.closureEvidence as string[]) || []),
    ...((item?.evidenceUrls as string[]) || []),
  ].filter(Boolean);

const actorLine = (label: string, actor: AnyRecord | string | null | undefined, at?: string | null) =>
  `${label}: ${typeof actor === "string" ? actor || "Pending" : pickName(actor as AnyRecord)} / ${at ? new Date(at).toLocaleString() : "Pending"}`;

function useMobileNotifications(projectId?: string) {
  const [items, setItems] = useState<AnyRecord[]>([]);

  useEffect(() => {
    if (!projectId) {
      setItems([]);
      return;
    }
    let mounted = true;
    Promise.allSettled([
      api.get("/quality/inspections", { params: { projectId } }),
      api.get(`/quality/${projectId}/observation-ncr`),
    ]).then(([inspectionRes, ncrRes]) => {
      if (!mounted) return;
      const inspections =
        inspectionRes.status === "fulfilled"
          ? Array.isArray(inspectionRes.value.data)
            ? inspectionRes.value.data
            : inspectionRes.value.data?.items || []
          : [];
      const ncrRows =
        ncrRes.status === "fulfilled" ? ncrRes.value.data || [] : [];
      const pending = inspections
        .filter((item: AnyRecord) => isPendingInspection(item))
        .slice(0, 5)
        .map((item: AnyRecord) => ({
          id: `rfi-${item.id}`,
          title: item.rfiNumber || `RFI #${item.id}`,
          subtitle: `${item.activityName || "Inspection"} / ${item.goLabel || "GO"}`,
          tone: "warn",
          to: `/m/projects/${projectId}/quality/inspections/${item.id}`,
        }));
      const rejected = inspections
        .filter((item: AnyRecord) => isRejectedInspection(item))
        .slice(0, 3)
        .map((item: AnyRecord) => ({
          id: `rejected-${item.id}`,
          title: item.rfiNumber || `RFI #${item.id}`,
          subtitle: "Rejected / action required",
          tone: "danger",
          to: `/m/projects/${projectId}/quality/inspections/${item.id}`,
        }));
      const ncr = (ncrRows || [])
        .filter((row: AnyRecord) => String(row.type || "").toUpperCase() === "NCR")
        .slice(0, 3)
        .map((row: AnyRecord) => ({
          id: `ncr-${row.id}`,
          title: row.sourceReference || "Quality NCR",
          subtitle: row.status || "Open NCR",
          tone: "danger",
          to: `/m/projects/${projectId}/quality/ncr`,
        }));
      setItems([...pending, ...rejected, ...ncr]);
    });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  return items;
}

function MobileNotificationShade({
  items,
  onClose,
}: {
  items: AnyRecord[];
  onClose: () => void;
}) {
  return (
    <div className="mobile-dialog-backdrop">
      <div className="mobile-notification-shade">
        <div className="mobile-row">
          <div>
            <h2 className="mobile-title">Notifications</h2>
            <p className="mobile-subtitle">Approvals, rework and NCR alerts</p>
          </div>
          <button className="mobile-icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="mobile-stack" style={{ marginTop: 14 }}>
          {items.length === 0 && <div className="mobile-card mobile-empty">No active alerts.</div>}
          {items.map((item) => (
            <Link key={item.id} className={`mobile-notification-item ${item.tone || ""}`} to={item.to} onClick={onClose}>
              <span />
              <div>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </div>
              <ChevronRight size={17} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileQuickFab({ projectId }: { projectId?: string }) {
  if (!projectId) return null;
  return (
    <div className="mobile-fab-menu">
      <Link to={`/m/projects/${projectId}/quality/locations`} title="Raise RFI">
        <Plus size={20} />
      </Link>
      <Link to={`/m/projects/${projectId}/quality/approvals`} title="Approvals">
        <ClipboardCheck size={19} />
      </Link>
      <Link to={`/m/projects/${projectId}/quality/observations`} title="Observations">
        <AlertTriangle size={19} />
      </Link>
    </div>
  );
}

function MobileShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { logout } = useAuth();
  const notifications = useMobileNotifications(projectId);
  const [theme] = useStoredMobileSetting<MobileTheme>("setu-mobile-theme", "light");
  const [siteMode] = useStoredMobileSetting<MobileSiteMode>("setu-mobile-site-mode", "normal");
  const [showNotifications, setShowNotifications] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [canAskNotify, setCanAskNotify] = useState(false);
  const projectBase = projectId ? `/m/projects/${projectId}` : "/m/projects";

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    setCanAskNotify(
      typeof Notification !== "undefined" &&
        Notification.permission === "default" &&
        Boolean(projectId),
    );
  }, [projectId]);

  return (
    <div className={`mobile-app mobile-theme-${theme} mobile-site-${siteMode}`}>
      <div className="mobile-shell">
        <header className="mobile-topbar">
          <button className="mobile-icon-button" onClick={() => navigate(-1)} type="button">
            <ArrowLeft size={19} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="mobile-title">{title}</h1>
            {subtitle && <p className="mobile-subtitle">{subtitle}</p>}
          </div>
          {installPrompt && (
            <button
              className="mobile-icon-button"
              type="button"
              title="Install app"
              onClick={async () => {
                await installPrompt.prompt?.();
                setInstallPrompt(null);
              }}
            >
              <Smartphone size={18} />
            </button>
          )}
          {canAskNotify && (
            <button
              className="mobile-icon-button"
              type="button"
              title="Enable notifications"
              onClick={async () => {
                await Notification.requestPermission();
                setCanAskNotify(false);
              }}
            >
              <Bell size={18} />
            </button>
          )}
          <button className="mobile-icon-button mobile-bell-button" onClick={() => setShowNotifications(true)} type="button" title="Notifications">
            <Bell size={18} />
            {notifications.length > 0 && <span>{notifications.length}</span>}
          </button>
          <Link className="mobile-icon-button" to="/m/settings" title="Mobile settings">
            <Settings size={18} />
          </Link>
          <button className="mobile-icon-button" onClick={logout} type="button" title="Logout">
            <LogOut size={18} />
          </button>
        </header>
        <main className="mobile-page">{children}</main>
        <MobileQuickFab projectId={projectId} />
        <nav className="mobile-bottom-nav">
          <NavLink to="/m/projects">
            <Home size={19} />
            Projects
          </NavLink>
          <NavLink to={`${projectBase}/quality`}>
            <ClipboardCheck size={19} />
            Quality
          </NavLink>
          <NavLink to={`${projectBase}/ehs`}>
            <ShieldAlert size={19} />
            EHS
          </NavLink>
          <NavLink to="/m/profile">
            <User size={19} />
            Profile
          </NavLink>
          <NavLink to="/m/settings">
            <Settings size={19} />
            Settings
          </NavLink>
        </nav>
        {showNotifications && (
          <MobileNotificationShade items={notifications} onClose={() => setShowNotifications(false)} />
        )}
      </div>
    </div>
  );
}

function LoadingCard({ label = "Loading..." }: { label?: string }) {
  return <div className="mobile-card mobile-empty">{label}</div>;
}

function ErrorCard({ message }: { message: string }) {
  return <div className="mobile-card mobile-empty" style={{ color: "#c51f1a" }}>{message}</div>;
}

function MobileLogin() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otpChallenge, setOtpChallenge] = useState<AnyRecord | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/m/projects" replace />;

  const completeLogin = async (token: string) => {
    const profileRes = await api.get("/auth/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    login(token, profileRes.data);
    navigate("/m/projects", { replace: true });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login", { username, password });
      if (response.data?.otpRequired) {
        setOtpChallenge(response.data);
        setOtp("");
      } else {
        await completeLogin(response.data.access_token);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await api.post("/auth/login/verify-otp", {
        challengeId: otpChallenge?.challengeId,
        otp,
      });
      await completeLogin(response.data.access_token);
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-app">
      <div className="mobile-login">
        <div className="mobile-login-card">
          <div className="mobile-chip">SETU Mobile Web</div>
          <h1 className="mobile-title" style={{ marginTop: 14, fontSize: 26 }}>
            {otpChallenge ? "Verify OTP" : "Login"}
          </h1>
          <p className="mobile-subtitle">
            {otpChallenge
              ? `OTP sent to ${otpChallenge.destinationMasked || "your email"}`
              : "Field workflows in a phone-first web interface."}
          </p>
          <form className="mobile-stack" style={{ marginTop: 18 }} onSubmit={otpChallenge ? verifyOtp : submit}>
            {otpChallenge ? (
              <input
                className="mobile-input"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            ) : (
              <>
                <input className="mobile-input" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
                <input className="mobile-input" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
              </>
            )}
            {error && <div className="mobile-chip danger">{error}</div>}
            <button className="mobile-button" disabled={loading}>
              {loading ? "Please wait..." : otpChallenge ? "Verify and continue" : "Login"}
            </button>
            {otpChallenge && (
              <button className="mobile-button secondary" type="button" onClick={() => setOtpChallenge(null)}>
                Back to login
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function useProjects() {
  const [nodes, setNodes] = useState<EpsNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    api
      .get("/eps")
      .then((res) => mounted && setNodes(res.data || []))
      .catch(() => mounted && setError("Unable to load projects."))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return { nodes, loading, error };
}

function ProjectsPage() {
  const [search, setSearch] = useState("");
  const { nodes, loading, error } = useProjects();
  const projects = useMemo(
    () =>
      nodes
        .filter((node) => node.type === "PROJECT")
        .filter((node) => node.name.toLowerCase().includes(search.toLowerCase())),
    [nodes, search],
  );

  return (
    <MobileShell title="Projects" subtitle="Select a project to continue">
      <div className="mobile-stack">
        <div className="mobile-card mobile-card-pad mobile-row">
          <Search size={18} className="mobile-muted" />
          <input className="mobile-input" style={{ border: 0, minHeight: 32, padding: 0 }} placeholder="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        {loading && <LoadingCard label="Loading projects..." />}
        {error && <ErrorCard message={error} />}
        {projects.map((project) => (
          <Link key={project.id} className="mobile-card mobile-card-pad" to={`/m/projects/${project.id}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className="mobile-row">
              <div>
                <div className="mobile-chip">Project</div>
                <h2 className="mobile-title" style={{ marginTop: 8 }}>{project.name}</h2>
                <p className="mobile-subtitle">Open field modules</p>
              </div>
              <Building2 color="#2e7d43" />
            </div>
          </Link>
        ))}
        {!loading && projects.length === 0 && <div className="mobile-card mobile-empty">No projects found.</div>}
      </div>
    </MobileShell>
  );
}

function ProjectModulesPage() {
  const { projectId } = useParams();
  const { nodes, loading } = useProjects();
  const project = nodes.find((node) => node.id === Number(projectId));
  const modules = [
    { title: "Quality", subtitle: "RFI, approvals, observations, NCR", icon: ClipboardCheck, to: "quality", tone: "green" },
    { title: "EHS", subtitle: "Safety observations and incidents", icon: ShieldAlert, to: "ehs", tone: "red" },
    { title: "Search", subtitle: "RFI, location, NCR, cube", icon: Search, to: "search", tone: "blue" },
    { title: "Approvals", subtitle: "My pending actions", icon: Bell, to: "quality/approvals", tone: "amber" },
    { title: "My Tasks", subtitle: "Action inbox", icon: ClipboardList, to: "tasks", tone: "blue" },
    { title: "QR Scan", subtitle: "Signature and lookup", icon: QrCode, to: "qr", tone: "green" },
    { title: "Profile", subtitle: "Signature and account", icon: User, to: "/m/profile", tone: "blue" },
    { title: "Settings", subtitle: "Field mode and display", icon: Settings, to: "/m/settings", tone: "amber" },
  ];
  return (
    <MobileShell title={project?.name || "Project"} subtitle={loading ? "Loading project..." : "App launcher"}>
      <div className="mobile-stack">
        <section className="mobile-os-hero">
          <div>
            <span>SETU FIELD OS</span>
            <h2>{project?.name || "Project"}</h2>
            <p>Open a module like an app. Actions and alerts stay available from the bottom bar and notification shade.</p>
          </div>
        </section>
        <div className="mobile-app-grid">
        {modules.map((module) => (
          <Link key={module.title} className={`mobile-app-icon ${module.tone}`} to={module.to}>
            <div className="mobile-app-icon-glyph">
              <module.icon size={24} />
            </div>
            <strong>{module.title}</strong>
            <small>{module.subtitle}</small>
          </Link>
        ))}
        </div>
      </div>
    </MobileShell>
  );
}

function useProjectInspections(projectId?: string) {
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId) return;
    let mounted = true;
    api
      .get("/quality/inspections", { params: { projectId } })
      .then((res) => mounted && setItems(Array.isArray(res.data) ? res.data : res.data?.items || []))
      .catch(() => mounted && setItems([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [projectId]);
  return { items, loading };
}

const normalizeStatus = (value?: string | null) => String(value || "").toUpperCase();

const isApprovedInspection = (item: AnyRecord) =>
  ["APPROVED", "PROVISIONALLY_APPROVED"].includes(normalizeStatus(item.status));

const isPendingInspection = (item: AnyRecord) =>
  ["PENDING", "PARTIALLY_APPROVED", "SUBMITTED", "IN_REVIEW"].some((status) =>
    normalizeStatus(item.status).includes(status),
  );

const isRejectedInspection = (item: AnyRecord) =>
  ["REJECTED", "CANCELED", "CANCELLED"].includes(normalizeStatus(item.status));

const nodeTypeLabel = (node?: EpsNode | null) =>
  String(node?.type || "Location").replace(/_/g, " ").toLowerCase();

function buildChildrenMap(nodes: EpsNode[]) {
  const map = new Map<number | null, EpsNode[]>();
  nodes.forEach((node) => {
    const children = map.get(node.parentId) || [];
    children.push(node);
    map.set(node.parentId, children);
  });
  map.forEach((children) => children.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
  return map;
}

function collectDescendantIds(parentId: number, childrenMap: Map<number | null, EpsNode[]>) {
  const ids = new Set<number>([parentId]);
  const visit = (id: number) => {
    (childrenMap.get(id) || []).forEach((child) => {
      ids.add(child.id);
      visit(child.id);
    });
  };
  visit(parentId);
  return ids;
}

function formatLocationPath(
  nodeId: number | string | null | undefined,
  nodes: EpsNode[],
  project?: EpsNode | null,
) {
  const numericId = Number(nodeId);
  if (!Number.isFinite(numericId)) return "";
  const byId = new Map<number, EpsNode>();
  if (project) byId.set(project.id, project);
  nodes.forEach((node) => byId.set(node.id, node));
  const names: string[] = [];
  let current = byId.get(numericId);
  const seen = new Set<number>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(" / ");
}

function inspectionProgress(items: AnyRecord[]) {
  const total = items.length;
  const approved = items.filter(isApprovedInspection).length;
  const pending = items.filter(isPendingInspection).length;
  const rejected = items.filter(isRejectedInspection).length;
  const pct = total ? Math.round((approved / total) * 100) : 0;
  return { total, approved, pending, rejected, pct };
}

function ActivityStatusStrip({ items }: { items: AnyRecord[] }) {
  const progress = inspectionProgress(items);
  return (
    <div className="mobile-progress-wrap">
      <div className="mobile-progress-bar">
        <span style={{ width: `${progress.pct}%` }} />
      </div>
      <div className="mobile-progress-label">
        <span>{progress.approved}/{progress.total} approved</span>
        <span>{progress.pct}%</span>
      </div>
    </div>
  );
}

function QualityHomePage() {
  const { projectId } = useParams();
  const { hasPermission } = useAuth();
  const { items, loading } = useProjectInspections(projectId);
  const { project, locations, loading: loadingLocations } = useProjectLocations(projectId);
  const [ncrs, setNcrs] = useState<AnyRecord[]>([]);
  const [qualitySearch, setQualitySearch] = useState("");
  const { favoriteIds } = useFavoriteLocations(projectId);
  const recentRfis = useRecentInspections(projectId);

  useEffect(() => {
    if (!projectId) return;
    api
      .get(`/quality/${projectId}/observation-ncr`)
      .then((res) => setNcrs((res.data || []).filter((row: AnyRecord) => String(row.type || "").toUpperCase() === "NCR")))
      .catch(() => setNcrs([]));
  }, [projectId]);

  const childrenMap = useMemo(() => buildChildrenMap([...(project ? [project] : []), ...locations]), [project, locations]);
  const rootLocations = useMemo(() => {
    const direct = childrenMap.get(Number(projectId)) || [];
    if (direct.length) return direct;
    return locations.filter((node) => ["BLOCK", "BUILDING", "TOWER", "FLOOR"].includes(String(node.type || "").toUpperCase())).slice(0, 12);
  }, [childrenMap, locations, projectId]);
  const progress = inspectionProgress(items);
  const recentPending = [...items]
    .filter((item) => !isApprovedInspection(item))
    .filter((item) => JSON.stringify(item).toLowerCase().includes(qualitySearch.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt || b.requestDate || 0).getTime() - new Date(a.createdAt || a.requestDate || 0).getTime())
    .slice(0, 4);
  const filteredRootLocations = rootLocations.filter((node) =>
    `${node.name} ${node.type}`.toLowerCase().includes(qualitySearch.toLowerCase()),
  );
  const favoriteLocations = locations.filter((node) => favoriteIds.includes(node.id)).slice(0, 8);
  const qualityApps = [
    ...(hasPermission(PermissionCode.QUALITY_INSPECTION_RAISE)
      ? [{ title: "Raise RFI", subtitle: "Location tree", icon: MapPin, to: `/m/projects/${projectId}/quality/locations`, tone: "green" }]
      : []),
    { title: "Search", subtitle: "All quality data", icon: Search, to: `/m/projects/${projectId}/search`, tone: "blue" },
    { title: "Approvals", subtitle: "My queue", icon: ClipboardCheck, to: `/m/projects/${projectId}/quality/approvals`, tone: "amber" },
    { title: "Observations", subtitle: "Quality issues", icon: AlertTriangle, to: `/m/projects/${projectId}/quality/observations`, tone: "red" },
    { title: "NC Register", subtitle: "Critical NCR", icon: FileText, to: `/m/projects/${projectId}/quality/ncr`, tone: "red" },
    { title: "Cube Tests", subtitle: "Material register", icon: Layers, to: `/m/projects/${projectId}/quality/materials/cubes`, tone: "blue" },
    { title: "All RFIs", subtitle: "Search list", icon: ListChecks, to: `/m/projects/${projectId}/quality/requests`, tone: "green" },
    { title: "My Tasks", subtitle: "Action inbox", icon: ClipboardList, to: `/m/projects/${projectId}/tasks`, tone: "blue" },
    { title: "QR", subtitle: "Scan / confirm", icon: QrCode, to: `/m/projects/${projectId}/qr`, tone: "green" },
  ];

  return (
    <MobileShell title="Checklist Progress" subtitle={project?.name || "Quality Management"}>
      <div className="mobile-stack">
        <section className="mobile-hero-card">
          <div className="mobile-row">
            <div>
              <span className="mobile-chip">Quality Field Core</span>
              <h2>{progress.pct}% complete</h2>
              <p>{progress.approved}/{progress.total} RFIs approved across this project</p>
            </div>
            <ClipboardCheck size={34} />
          </div>
          <ActivityStatusStrip items={items} />
        </section>

        <div className="mobile-kpi-strip">
          <div className="mobile-kpi"><strong>{items.length}</strong><span>Total RFIs</span></div>
          <div className="mobile-kpi"><strong>{progress.pending}</strong><span>In Review</span></div>
          <div className="mobile-kpi"><strong>{progress.rejected}</strong><span>Rejected</span></div>
          <div className="mobile-kpi"><strong>{ncrs.length}</strong><span>NCR</span></div>
        </div>

        <div className="mobile-search-card">
          <Search size={17} />
          <input
            placeholder="Search Quality: RFI, GO, location, drawing"
            value={qualitySearch}
            onChange={(event) => setQualitySearch(event.target.value)}
          />
        </div>

        <h3 className="mobile-section-title">Quality Apps</h3>
        <div className="mobile-app-grid compact">
          {qualityApps.map((app) => (
            <Link key={app.title} className={`mobile-app-icon ${app.tone}`} to={app.to}>
              <div className="mobile-app-icon-glyph">
                <app.icon size={22} />
              </div>
              <strong>{app.title}</strong>
              <small>{app.subtitle}</small>
            </Link>
          ))}
        </div>

        {favoriteLocations.length > 0 && (
          <>
            <h3 className="mobile-section-title">Favorite Locations</h3>
            <div className="mobile-horizontal-cards">
              {favoriteLocations.map((node) => (
                <Link key={node.id} className="mobile-mini-card" to={`/m/projects/${projectId}/quality/locations/${node.id}`}>
                  <Star size={16} />
                  <strong>{node.name}</strong>
                  <small>{nodeTypeLabel(node)}</small>
                </Link>
              ))}
            </div>
          </>
        )}

        {recentRfis.length > 0 && (
          <>
            <h3 className="mobile-section-title">Recently Opened</h3>
            <div className="mobile-stack">
              {recentRfis.slice(0, 3).map((item) => (
                <Link key={`${item.projectId}-${item.id}`} className="mobile-recent-row" to={`/m/projects/${projectId}/quality/inspections/${item.id}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </div>
                  <span className={statusChipClass(item.status)}>{item.status}</span>
                </Link>
              ))}
            </div>
          </>
        )}

        <h3 className="mobile-section-title">Locations</h3>
        <div className="mobile-card mobile-card-pad">
          <h3 className="mobile-title">Location Tree</h3>
          <p className="mobile-subtitle">Expand the project structure, then open the floor/unit/room where the checklist has to be raised.</p>
          <div className="mobile-tree-list">
            {filteredRootLocations.map((node) => (
              <MobileLocationTree key={`tree-${node.id}`} node={node} childrenMap={childrenMap} inspections={items} />
            ))}
          </div>
        </div>
        {loadingLocations && <LoadingCard label="Loading project locations..." />}
        {!loadingLocations && filteredRootLocations.length === 0 && <div className="mobile-card mobile-empty">No project locations found.</div>}
        {filteredRootLocations.map((node) => {
          const ids = collectDescendantIds(node.id, childrenMap);
          const nodeItems = items.filter((item) => ids.has(Number(item.epsNodeId || item.locationId)));
          return <LocationProgressCard key={node.id} node={node} inspections={nodeItems} />;
        })}

        <h3 className="mobile-section-title">Priority Queue</h3>
        {loading && <LoadingCard label="Loading RFIs..." />}
        {recentPending.map((item) => <MobileInspectionCard key={item.id} item={item} />)}
        {!loading && recentPending.length === 0 && <div className="mobile-card mobile-empty">No pending RFIs right now.</div>}
      </div>
    </MobileShell>
  );
}

function LocationProgressCard({ node, inspections }: { node: EpsNode; inspections: AnyRecord[] }) {
  const { projectId } = useParams();
  const progress = inspectionProgress(inspections);
  const accent = progress.rejected > 0 ? "danger" : progress.pending > 0 ? "warn" : progress.total > 0 && progress.approved === progress.total ? "ok" : "idle";
  return (
    <Link className={`mobile-location-card ${accent}`} to={`/m/projects/${projectId}/quality/locations/${node.id}`}>
      <div className="mobile-location-leading">
        <span />
        <div>
          <h3>{node.name}</h3>
          <p>{nodeTypeLabel(node)} / {progress.total} RFI</p>
        </div>
      </div>
      <ActivityStatusStrip items={inspections} />
      <div className="mobile-row">
        <span className={statusChipClass(progress.pending ? "PENDING" : progress.rejected ? "REJECTED" : progress.approved ? "APPROVED" : "NOT_STARTED")}>
          {progress.total === 0 ? "Not started" : progress.pending ? `${progress.pending} pending` : progress.rejected ? `${progress.rejected} rejected` : "On track"}
        </span>
        <ChevronRight size={18} />
      </div>
    </Link>
  );
}

function MobileGlobalSearchPage() {
  const { projectId } = useParams();
  const { items: inspections, loading } = useProjectInspections(projectId);
  const { locations } = useProjectLocations(projectId);
  const [query, setQuery] = useState("");
  const [ncrs, setNcrs] = useState<AnyRecord[]>([]);
  const [cubes, setCubes] = useState<AnyRecord[]>([]);

  useEffect(() => {
    if (!projectId) return;
    api
      .get(`/quality/${projectId}/observation-ncr`)
      .then((res) => setNcrs(res.data || []))
      .catch(() => setNcrs([]));
    qualityService.getCubeTestRegister(Number(projectId)).then(setCubes).catch(() => setCubes([]));
  }, [projectId]);

  const text = query.trim().toLowerCase();
  const matches = (value: unknown) => Boolean(text) && JSON.stringify(value || {}).toLowerCase().includes(text);
  const rfiResults = inspections.filter(matches).slice(0, 15);
  const locationResults = locations.filter(matches).slice(0, 15);
  const ncrResults = ncrs.filter(matches).slice(0, 15);
  const cubeResults = cubes.filter(matches).slice(0, 15);

  return (
    <MobileShell title="Search SETU" subtitle="RFI, location, NCR and cube register">
      <div className="mobile-stack">
        <div className="mobile-search-card sticky">
          <Search size={17} />
          <input
            autoFocus
            placeholder="Search RFI number, GO, drawing, location, NCR, cube"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {!query.trim() && (
          <section className="mobile-card mobile-card-pad">
            <h3 className="mobile-title">Start typing to search</h3>
            <p className="mobile-subtitle">Use this like a field command center: RFI numbers, GO details, drawings, element names, cube IDs and NCR references all work here.</p>
          </section>
        )}
        {loading && <LoadingCard label="Loading quality records..." />}

        <SearchSection title="RFIs" count={rfiResults.length}>
          {rfiResults.map((item) => <MobileInspectionCard key={item.id} item={item} />)}
        </SearchSection>

        <SearchSection title="Locations" count={locationResults.length}>
          {locationResults.map((node) => (
            <Link key={node.id} className="mobile-search-result" to={`/m/projects/${projectId}/quality/locations/${node.id}`}>
              <MapPin size={17} />
              <div>
                <strong>{node.name}</strong>
                <small>{nodeTypeLabel(node)}</small>
              </div>
              <ChevronRight size={17} />
            </Link>
          ))}
        </SearchSection>

        <SearchSection title="NCR / Observations" count={ncrResults.length}>
          {ncrResults.map((item) => (
            <Link key={item.id} className="mobile-search-result" to={`/m/projects/${projectId}/quality/ncr`}>
              <ShieldAlert size={17} />
              <div>
                <strong>{item.sourceReference || item.title || `NCR #${item.id}`}</strong>
                <small>{item.status || item.observationRating || "Observation"}</small>
              </div>
              <span className={statusChipClass(item.status || item.observationRating)}>{item.status || "NCR"}</span>
            </Link>
          ))}
        </SearchSection>

        <SearchSection title="Cube Tests" count={cubeResults.length}>
          {cubeResults.map((item) => (
            <Link key={item.id} className="mobile-search-result" to={`/m/projects/${projectId}/quality/materials/cubes`}>
              <Layers size={17} />
              <div>
                <strong>{item.cubeId || `Cube #${item.id}`}</strong>
                <small>{item.mixIdOrGrade || item.locationText || "Cube test"}</small>
              </div>
              <span className={statusChipClass(item.status)}>{item.status || dateText(item.dueDate)}</span>
            </Link>
          ))}
        </SearchSection>
      </div>
    </MobileShell>
  );
}

function SearchSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <>
      <div className="mobile-row">
        <h3 className="mobile-section-title" style={{ margin: 0 }}>{title}</h3>
        <span className="mobile-chip">{count}</span>
      </div>
      <div className="mobile-stack">{children}</div>
    </>
  );
}

function MobileLocationTree({
  node,
  childrenMap,
  inspections,
}: {
  node: EpsNode;
  childrenMap: Map<number | null, EpsNode[]>;
  inspections: AnyRecord[];
}) {
  const { projectId } = useParams();
  const children = childrenMap.get(node.id) || [];
  const ids = collectDescendantIds(node.id, childrenMap);
  const nodeItems = inspections.filter((item) => ids.has(Number(item.epsNodeId || item.locationId)));
  const progress = inspectionProgress(nodeItems);
  return (
    <details className="mobile-tree-node">
      <summary title={`${node.name} (${node.type}) - ${progress.approved}/${progress.total} approved`}>
        <span>
          <MapPin size={15} />
          <strong>{node.name}</strong>
          <small>{nodeTypeLabel(node)} / {progress.total ? `${progress.pct}%` : "not started"}</small>
        </span>
        <Link to={`/m/projects/${projectId}/quality/locations/${node.id}`} onClick={(event) => event.stopPropagation()}>
          Open
        </Link>
      </summary>
      {children.length > 0 && (
        <div className="mobile-tree-children">
          {children.map((child) => (
            <MobileLocationTree key={child.id} node={child} childrenMap={childrenMap} inspections={inspections} />
          ))}
        </div>
      )}
    </details>
  );
}

function MobileLocationPickerTree({
  node,
  childrenMap,
  selectedId,
  onSelect,
  depth = 0,
  searchActive = false,
}: {
  node: EpsNode;
  childrenMap: Map<number | null, EpsNode[]>;
  selectedId?: string;
  onSelect: (node: EpsNode) => void;
  depth?: number;
  searchActive?: boolean;
}) {
  const children = childrenMap.get(node.id) || [];
  const selectable = ["FLOOR", "UNIT", "ROOM"].includes(String(node.type || "").toUpperCase());
  const selected = String(node.id) === String(selectedId || "");
  const containsSelected = Boolean(
    selectedId && collectDescendantIds(node.id, childrenMap).has(Number(selectedId)),
  );
  const shouldOpen = searchActive || depth === 0 || selected || containsSelected;
  return (
    <details className={`mobile-tree-node picker ${selected ? "selected" : ""}`} open={shouldOpen}>
      <summary title={`${node.name} (${node.type})`}>
        <span>
          <MapPin size={15} />
          <strong>{node.name}</strong>
          <small>{nodeTypeLabel(node)}</small>
        </span>
        {selectable ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(node);
            }}
          >
            {selected ? "Selected" : "Select"}
          </button>
        ) : (
          <small>Open</small>
        )}
      </summary>
      {children.length > 0 && (
        <div className="mobile-tree-children">
          {children.map((child) => (
            <MobileLocationPickerTree
              key={child.id}
              node={child}
              childrenMap={childrenMap}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
              searchActive={searchActive}
            />
          ))}
        </div>
      )}
    </details>
  );
}

function InspectionCard({ item }: { item: AnyRecord }) {
  const { projectId } = useParams();
  return (
    <Link className="mobile-card mobile-card-pad" to={`/m/projects/${projectId}/quality/inspections/${item.id}`} style={{ color: "inherit", textDecoration: "none" }}>
      <div className="mobile-row">
        <div>
          <span className={statusChipClass(item.status)}>{item.status || "RFI"}</span>
          <h3 className="mobile-title" style={{ marginTop: 8 }}>{item.rfiNumber || `RFI #${item.id}`}</h3>
          <p className="mobile-subtitle">{item.activityName || item.checklistName || item.listName || "Checklist"} · {item.goLabel || item.goName || "GO"}</p>
          <p className="mobile-subtitle">Raised by {pickName(item.raisedBy || item.createdByUser)}</p>
        </div>
        <FileText color="#2e7d43" />
      </div>
    </Link>
  );
}

function MobileInspectionCard({ item }: { item: AnyRecord }) {
  const { projectId } = useParams();
  const progressText =
    item.stageApprovalSummary?.approvedStages && item.stageApprovalSummary?.totalStages
      ? `${item.stageApprovalSummary.approvedStages}/${item.stageApprovalSummary.totalStages} stages`
      : item.pendingApprovalDisplay || item.pendingApprovalLabel || item.workflowStatus || "Checklist";
  return (
    <Link className="mobile-inspection-card" to={`/m/projects/${projectId}/quality/inspections/${item.id}`}>
      <div className="mobile-row">
        <div>
          <span className={statusChipClass(item.status)}>{item.status || "RFI"}</span>
          <h3>{item.rfiNumber || `RFI #${item.id}`} / {item.activityName || item.checklistName || item.listName || "Inspection"}</h3>
          <p>{item.goLabel || item.goName || "GO 1"} / {item.elementName || item.epsNodeLabel || item.locationDisplay || "Location not set"}</p>
          <p>Raised by {pickName(item.raisedBy || item.createdByUser)} / {dateText(item.requestDate || item.createdAt)}</p>
        </div>
        <FileText color="#2e7d43" />
      </div>
      <div className="mobile-row" style={{ marginTop: 10 }}>
        <span className="mobile-chip">{progressText}</span>
        <ChevronRight size={18} />
      </div>
    </Link>
  );
}

function RfiListPage({ approvals = false }: { approvals?: boolean }) {
  const { projectId } = useParams();
  const { hasPermission } = useAuth();
  const { items, loading } = useProjectInspections(projectId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(approvals ? "PENDING" : "ALL");
  const filtered = items
    .filter((item) => {
      if (filter === "PENDING") return isPendingInspection(item);
      if (filter === "APPROVED") return isApprovedInspection(item);
      if (filter === "REJECTED") return isRejectedInspection(item);
      return true;
    })
    .filter((item) =>
      JSON.stringify(item).toLowerCase().includes(search.toLowerCase()),
    );
  return (
    <MobileShell title={approvals ? "QA/QC Approvals" : "Quality Requests"} subtitle={approvals ? "Review pending RFIs" : "Raised RFI list"}>
      <div className="mobile-stack">
        <div className="mobile-search-card">
          <Search size={17} />
          <input placeholder="Search RFI, GO, element, floor" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="mobile-pill-tabs">
          {["PENDING", "ALL", "APPROVED", "REJECTED"].map((key) => (
            <button key={key} className={filter === key ? "active" : ""} type="button" onClick={() => setFilter(key)}>
              {key === "ALL" ? "All" : key.charAt(0) + key.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {!approvals && hasPermission(PermissionCode.QUALITY_INSPECTION_RAISE) && (
          <Link className="mobile-button" to="../locations"><Plus size={18} /> Raise by location</Link>
        )}
        {loading && <LoadingCard label="Loading RFIs..." />}
        {filtered.map((item) => <MobileInspectionCard key={item.id} item={item} />)}
        {!loading && filtered.length === 0 && <div className="mobile-card mobile-empty">No RFIs found.</div>}
      </div>
    </MobileShell>
  );
}

function MobileSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mobile-dialog-backdrop">
      <div className="mobile-sheet">
        <div className="mobile-row" style={{ marginBottom: 12 }}>
          <h2 className="mobile-title">{title}</h2>
          <button className="mobile-icon-button" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useProjectLocations(projectId?: string) {
  const { nodes, loading } = useProjects();
  const project = nodes.find((node) => node.id === Number(projectId));
  const descendants = useMemo(() => {
    if (!project) return [];
    const byParent = new Map<number | null, EpsNode[]>();
    nodes.forEach((node) => {
      const list = byParent.get(node.parentId) || [];
      list.push(node);
      byParent.set(node.parentId, list);
    });
    const result: EpsNode[] = [];
    const visit = (id: number) => {
      (byParent.get(id) || []).forEach((node) => {
        result.push(node);
        visit(node.id);
      });
    };
    visit(project.id);
    return result.filter((node) => !["COMPANY", "PROJECT"].includes(node.type));
  }, [nodes, project]);
  return { project, locations: descendants, loading };
}

function useQualityActivityLists(projectId?: string) {
  const [lists, setLists] = useState<ActivityListOption[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!projectId) return;
    let mounted = true;
    setLoading(true);
    api
      .get("/quality/activity-lists", { params: { projectId } })
      .then(async (res) => {
        const lists = Array.isArray(res.data) ? res.data : [];
        const activityGroups = await Promise.all(
          lists.map(async (list: AnyRecord) => {
            try {
              const activityRes = await api.get(
                `/quality/activity-lists/${list.id}/activities`,
              );
              const activities = (activityRes.data || []).map((activity: AnyRecord) => ({
                id: Number(activity.id),
                name: activity.name || activity.activityName || `Activity ${activity.id}`,
                listName: list.name || list.listName || "Checklist",
                listId: Number(list.id),
                description: activity.description,
                applicabilityLevel: activity.applicabilityLevel,
                requiresPourCard: Boolean(activity.requiresPourCard),
                requiresPourClearanceCard: Boolean(activity.requiresPourClearanceCard),
              }));
              return {
                id: Number(list.id),
                name: list.name || list.listName || "Checklist",
                description: list.description,
                activities,
              };
            } catch {
              return {
                id: Number(list.id),
                name: list.name || list.listName || "Checklist",
                description: list.description,
                activities: [],
              };
            }
          }),
        );
        if (mounted) setLists(activityGroups);
      })
      .catch(() => mounted && setLists([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [projectId]);
  return { lists, loading };
}

function useQualityActivities(projectId?: string) {
  const { lists, loading } = useQualityActivityLists(projectId);
  const activities = useMemo(
    () => lists.flatMap((list) => list.activities),
    [lists],
  );
  return { activities, loading };
}

function QualityLocationPage() {
  const { projectId, epsNodeId } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { project, locations, loading: loadingLocations } = useProjectLocations(projectId);
  const { lists, loading: loadingLists } = useQualityActivityLists(projectId);
  const [inspections, setInspections] = useState<AnyRecord[]>([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const numericEpsNodeId = Number(epsNodeId);
  const hasValidEpsNodeId = Number.isFinite(numericEpsNodeId);
  const allNodes = useMemo(() => [...(project ? [project] : []), ...locations], [project, locations]);
  const childrenMap = useMemo(() => buildChildrenMap(allNodes), [allNodes]);
  const selectedNode = hasValidEpsNodeId ? allNodes.find((node) => node.id === numericEpsNodeId) : undefined;
  const childNodes = selectedNode ? childrenMap.get(selectedNode.id) || [] : [];
  const isRfiLevel = ["FLOOR", "UNIT", "ROOM"].includes(String(selectedNode?.type || "").toUpperCase());
  const { favoriteIds, toggleFavorite } = useFavoriteLocations(projectId);
  const canRaiseInspection = hasPermission(PermissionCode.QUALITY_INSPECTION_RAISE);

  const loadInspections = async () => {
    if (!projectId || !hasValidEpsNodeId) return;
    setLoadingInspections(true);
    try {
      const res = await api.get("/quality/inspections", {
        params: { projectId, epsNodeId: numericEpsNodeId },
      });
      setInspections(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch {
      setInspections([]);
    } finally {
      setLoadingInspections(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, [projectId, epsNodeId]);

  const reserveAddGo = async (activity: ActivityOption) => {
    if (!projectId || !hasValidEpsNodeId) return;
    try {
      const result = await qualityService.addInspectionGo({
        projectId: Number(projectId),
        epsNodeId: numericEpsNodeId,
        activityId: activity.id,
      });
      navigate(
        `/m/projects/${projectId}/quality/requests/new?epsNodeId=${epsNodeId}&activityId=${activity.id}&listId=${activity.listId}&partNo=${result.nextGoNo}&totalParts=${result.newTotalParts}&goLabel=${encodeURIComponent(result.nextGoLabel)}`,
      );
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to reserve next GO.");
    }
  };

  if (!hasValidEpsNodeId) {
    return <Navigate to={`/m/projects/${projectId}/quality`} replace />;
  }

  return (
    <MobileShell title={selectedNode?.name || "Location"} subtitle={selectedNode ? `${nodeTypeLabel(selectedNode)} / checklist activities` : "Quality location"}>
      <div className="mobile-stack">
        {(loadingLocations || loadingInspections) && <LoadingCard label="Loading location progress..." />}
        {selectedNode && (
          <section className="mobile-card mobile-card-pad">
            <div className="mobile-row">
              <div>
                <span className="mobile-chip">{nodeTypeLabel(selectedNode)}</span>
                <h2 className="mobile-title" style={{ marginTop: 8 }}>{selectedNode.name}</h2>
                <p className="mobile-subtitle">{isRfiLevel ? "RFI can be raised here" : "Drill down to a floor, unit, or room"}</p>
              </div>
              <button
                className={`mobile-icon-button mobile-favorite-button ${favoriteIds.includes(selectedNode.id) ? "active" : ""}`}
                type="button"
                title={favoriteIds.includes(selectedNode.id) ? "Remove favorite" : "Add favorite"}
                onClick={() => toggleFavorite(selectedNode.id)}
              >
                <Star size={18} />
              </button>
            </div>
            <ActivityStatusStrip items={inspections} />
          </section>
        )}

        {childNodes.length > 0 && (
          <>
            <h3 className="mobile-section-title">Next Level</h3>
            {childNodes.map((node) => {
              const ids = collectDescendantIds(node.id, childrenMap);
              const nodeItems = inspections.filter((item) => ids.has(Number(item.epsNodeId || item.locationId)));
              return <LocationProgressCard key={node.id} node={node} inspections={nodeItems} />;
            })}
          </>
        )}

        {isRfiLevel && (
          <>
            <div className="mobile-row" style={{ marginTop: 4 }}>
              <h3 className="mobile-section-title" style={{ margin: 0 }}>Checklist Lists</h3>
              <button className="mobile-icon-button" type="button" onClick={loadInspections} title="Refresh">
                <RefreshCw size={17} />
              </button>
            </div>
            {loadingLists && <LoadingCard label="Loading checklist activities..." />}
            {!loadingLists && lists.length === 0 && <div className="mobile-card mobile-empty">No checklist lists configured for this project.</div>}
            {lists.map((list) => (
              <div key={list.id} className="mobile-checklist-card">
                <div className="mobile-row">
                  <div>
                    <span className="mobile-chip">{list.activities.length} activities</span>
                    <h3>{list.name}</h3>
                    {list.description && <p>{list.description}</p>}
                  </div>
                  <ListChecks color="#2e7d43" />
                </div>
                <div className="mobile-stack" style={{ marginTop: 12 }}>
                  {list.activities.map((activity) => (
                    <QualityActivityCard
                      key={activity.id}
                      activity={activity}
                      inspections={inspections.filter((item) => Number(item.activityId) === activity.id)}
                      onRaise={() =>
                        navigate(`/m/projects/${projectId}/quality/requests/new?epsNodeId=${epsNodeId}&activityId=${activity.id}&listId=${activity.listId}`)
                      }
                      onAddGo={() => reserveAddGo(activity)}
                      canRaise={canRaiseInspection}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </MobileShell>
  );
}

function QualityActivityCard({
  activity,
  inspections,
  onRaise,
  onAddGo,
  canRaise,
}: {
  activity: ActivityOption;
  inspections: AnyRecord[];
  onRaise: () => void;
  onAddGo: () => void;
  canRaise: boolean;
}) {
  const { projectId } = useParams();
  const orderedGos = [...inspections].sort((a, b) => {
    const aGo = Number(a.goNo || a.partNo || 1);
    const bGo = Number(b.goNo || b.partNo || 1);
    if (aGo !== bGo) return aGo - bGo;
    return new Date(a.createdAt || a.requestDate || 0).getTime() - new Date(b.createdAt || b.requestDate || 0).getTime();
  });
  const latest = orderedGos[orderedGos.length - 1];
  const progress = inspectionProgress(inspections);
  const canAddGo = inspections.length > 0;
  const status = latest?.status || (inspections.length ? "RAISED" : "NOT_STARTED");
  return (
    <div className="mobile-activity-card">
      <div className="mobile-row">
        <div>
          <span className={statusChipClass(status)}>{inspections.length ? status : "Ready"}</span>
          <h4>{activity.name}</h4>
          <p>{activity.applicabilityLevel || "FLOOR"} / {activity.requiresPourCard ? "Pour card" : "Checklist"}{activity.requiresPourClearanceCard ? " + clearance" : ""}</p>
        </div>
        <span className="mobile-chip">{progress.total ? `${progress.approved}/${progress.total}` : "0/0"}</span>
      </div>
      {activity.description && <p className="mobile-subtitle">{activity.description}</p>}
      {inspections.length > 0 && <ActivityStatusStrip items={inspections} />}
      {orderedGos.length > 0 && (
        <div className="mobile-go-list">
          {orderedGos.map((go) => (
            <Link key={go.id} to={`/m/projects/${projectId}/quality/inspections/${go.id}`} className="mobile-go-chip">
              <span className={statusChipClass(go.status)}>{go.goLabel || go.goName || `GO ${go.goNo || go.partNo || 1}`}</span>
              <strong>{go.rfiNumber || `RFI #${go.id}`}</strong>
              <small>{go.elementName || go.goDetails || go.locationDisplay || "No element details"}</small>
            </Link>
          ))}
        </div>
      )}
      <div className="mobile-action-row">
        {latest && <Link className="mobile-button secondary" to={`/m/projects/${projectId}/quality/inspections/${latest.id}`}>Open RFI</Link>}
        {canRaise && (
          <button className="mobile-button" type="button" onClick={onRaise}>
            <Plus size={16} /> {inspections.length ? "Raise RFI" : "Raise GO 1"}
          </button>
        )}
        {canRaise && canAddGo && (
          <button className="mobile-button secondary" type="button" onClick={onAddGo}>
            Add GO
          </button>
        )}
      </div>
    </div>
  );
}

function RaiseRfiPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const { locations, loading: loadingLocations } = useProjectLocations(projectId);
  const { activities, loading: loadingActivities } = useQualityActivities(projectId);
  const [form, setForm] = useState({
    epsNodeId: searchParams.get("epsNodeId") || "",
    activityId: searchParams.get("activityId") || "",
    listId: searchParams.get("listId") || "",
    drawingNo: "",
    elementName: "",
    goDetails: "",
    comments: "",
    vendorId: "",
  });
  const [locationSearch, setLocationSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activeSheet, setActiveSheet] = useState<"location" | "activity" | "related" | null>(null);
  const [relatedOptions, setRelatedOptions] = useState<AnyRecord[]>([]);
  const [relatedIds, setRelatedIds] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<AnyRecord[]>([]);
  const [vendors, setVendors] = useState<AnyRecord[]>([]);
  const [previewRelated, setPreviewRelated] = useState<AnyRecord | null>(null);
  const [previewAttachments, setPreviewAttachments] = useState<AnyRecord[]>([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const partNo = Number(searchParams.get("partNo") || 1);
  const totalParts = Number(searchParams.get("totalParts") || partNo || 1);
  const goLabel = searchParams.get("goLabel") || `GO ${partNo}`;
  const draftKey = `setu-mobile-rfi-draft-${projectId || "global"}`;

  const selectedLocation = locations.find((location) => location.id === Number(form.epsNodeId));
  const selectedActivity = activities.find((activity) => activity.id === Number(form.activityId));
  const locationTreeNodes = useMemo(() => locations, [locations]);
  const locationChildrenMap = useMemo(() => buildChildrenMap(locationTreeNodes), [locationTreeNodes]);
  const locationIds = useMemo(() => new Set(locationTreeNodes.map((node) => node.id)), [locationTreeNodes]);
  const locationRoots = useMemo(
    () => locationTreeNodes.filter((node) => !node.parentId || !locationIds.has(node.parentId)),
    [locationIds, locationTreeNodes],
  );

  useEffect(() => {
    if (!projectId) return;
    api
      .get("/quality/inspections/active-vendors", { params: { projectId } })
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        setVendors(rows);
        if (rows.length === 1) {
          setForm((current) => ({ ...current, vendorId: String(rows[0].id) }));
        }
      })
      .catch(() => setVendors([]));
  }, [projectId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((current) => ({
          ...current,
          ...parsed,
          epsNodeId: current.epsNodeId || parsed.epsNodeId || "",
          activityId: current.activityId || parsed.activityId || "",
          listId: current.listId || parsed.listId || "",
        }));
      }
    } catch {
      // Ignore invalid local draft.
    }
  }, [draftKey]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(form));
    }, 250);
    return () => window.clearTimeout(id);
  }, [draftKey, form]);

  useEffect(() => {
    if (!projectId || !form.epsNodeId) {
      setRelatedOptions([]);
      setRelatedIds([]);
      return;
    }
    qualityService
      .getRelatedChecklistOptions(Number(projectId), Number(form.epsNodeId))
      .then((rows) => setRelatedOptions(rows as AnyRecord[]))
      .catch(() => setRelatedOptions([]));
  }, [projectId, form.epsNodeId]);

  const filteredLocations = locations.filter((location) =>
    `${location.name} ${location.type}`.toLowerCase().includes(locationSearch.toLowerCase()),
  );
  const filteredActivities = activities.filter((activity) =>
    `${activity.name} ${activity.listName}`.toLowerCase().includes(activitySearch.toLowerCase()),
  );
  const groupedActivities = useMemo(() => {
    const groups = new Map<string, { key: string; listName: string; activities: ActivityOption[] }>();
    filteredActivities.forEach((activity) => {
      const key = `${activity.listId}-${activity.listName}`;
      const group = groups.get(key) || {
        key,
        listName: activity.listName || "Checklist",
        activities: [],
      };
      group.activities.push(activity);
      groups.set(key, group);
    });
    return Array.from(groups.values());
  }, [filteredActivities]);
  const canRaiseInspection = hasPermission(PermissionCode.QUALITY_INSPECTION_RAISE);

  const uploadDraft = async (file: File) => {
    if (!projectId) return;
    const draft = await qualityService.uploadInspectionAttachmentDraft(Number(projectId), file, {
      attachmentType: file.type === "application/pdf" ? "SUPPORTING_DOCUMENT" : "DRAWING_MARKUP",
    });
    setDrafts((current) => [...current, draft]);
  };

  const submit = async () => {
    if (!canRaiseInspection) {
      setMessage("You do not have permission to raise RFIs.");
      return;
    }
    if (!form.epsNodeId || !form.activityId) {
      setMessage("Select location and checklist activity.");
      return;
    }
    if (!form.drawingNo.trim()) {
      setMessage("Drawing number is mandatory.");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      const created = await api.post("/quality/inspections", {
        projectId: Number(projectId),
        epsNodeId: Number(form.epsNodeId),
        activityId: Number(form.activityId),
        listId: Number(form.listId || selectedActivity?.listId),
        processCode: "QA_QC_APPROVAL",
        documentType:
          selectedActivity?.applicabilityLevel === "ROOM"
            ? "ROOM_RFI"
            : selectedActivity?.applicabilityLevel === "UNIT"
              ? "UNIT_RFI"
              : "FLOOR_RFI",
        drawingNo: form.drawingNo.trim(),
        elementName: form.elementName.trim() || undefined,
        goDetails: form.goDetails,
        comments: form.comments || `Requested via Mobile Web (${goLabel})`,
        partNo,
        totalParts,
        partLabel: goLabel,
        goNo: partNo,
        goLabel,
        vendorId: form.vendorId ? Number(form.vendorId) : undefined,
        relatedChecklistInspectionIds: relatedIds,
        attachmentDraftIds: drafts.map((draft) => draft.id),
      });
      setMessage("RFI submitted successfully.");
      localStorage.removeItem(draftKey);
      const newId = created.data?.id || created.data?.inspection?.id;
      if (newId) {
        navigate(`/m/projects/${projectId}/quality/inspections/${newId}`, { replace: true });
      }
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Unable to submit. Enter valid location/activity IDs from the checklist setup.");
    } finally {
      setSubmitting(false);
    }
  };

  const openRelatedPreview = async (child: AnyRecord) => {
    const id = Number(child.inspectionId || child.id);
    setPreviewRelated(child);
    setPreviewAttachments([]);
    try {
      const detail = await api.get(`/quality/inspections/${id}`);
      setPreviewRelated({ ...child, ...detail.data });
      const attachmentRows = await qualityService.getInspectionAttachments(id);
      setPreviewAttachments(attachmentRows);
    } catch {
      setPreviewRelated(child);
    }
  };

  return (
    <MobileShell title="Raise RFI" subtitle={`${goLabel} / ${selectedActivity?.name || "Checklist activity"}`}>
      <div className="mobile-stack">
        {!canRaiseInspection && (
          <div className="mobile-card mobile-empty">You do not have permission to raise RFIs.</div>
        )}
        <div className="mobile-card mobile-card-pad">
          <div className="mobile-chip">Step 1</div>
          <h3 className="mobile-title" style={{ marginTop: 8 }}>Location and checklist</h3>
          <p className="mobile-subtitle">Select the same project location and checklist activity used in the Flutter app.</p>
          <div className="mobile-stack" style={{ marginTop: 12 }}>
            <button className="mobile-button secondary" type="button" onClick={() => setActiveSheet("location")}>
              {selectedLocation
                ? `${selectedLocation.name} (${selectedLocation.type})`
                : loadingLocations
                  ? "Loading locations..."
                  : "Select location"}
            </button>
            <button className="mobile-button secondary" type="button" onClick={() => setActiveSheet("activity")}>
              {selectedActivity
                ? `${selectedActivity.listName} / ${selectedActivity.name}`
                : loadingActivities
                  ? "Loading activities..."
                  : "Select checklist activity"}
            </button>
            {vendors.length > 0 && (
              <select className="mobile-select" value={form.vendorId} onChange={(event) => setForm({ ...form, vendorId: event.target.value })}>
                <option value="">Select vendor / contractor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name || vendor.vendorName || vendor.companyName || `Vendor ${vendor.id}`}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="mobile-card mobile-card-pad mobile-draft-banner">
          <span>Draft autosaved on this device</span>
          <button
            className="mobile-button secondary"
            type="button"
            onClick={() => {
              localStorage.removeItem(draftKey);
              setForm({
                epsNodeId: searchParams.get("epsNodeId") || "",
                activityId: searchParams.get("activityId") || "",
                listId: searchParams.get("listId") || "",
                drawingNo: "",
                elementName: "",
                goDetails: "",
                comments: "",
                vendorId: "",
              });
            }}
          >
            Clear Draft
          </button>
        </div>
        <div className="mobile-card mobile-card-pad">
          <div className="mobile-chip">Step 2</div>
          <h3 className="mobile-title" style={{ marginTop: 8 }}>{goLabel} details</h3>
          <input className="mobile-input" placeholder="Drawing number *" value={form.drawingNo} onChange={(e) => setForm({ ...form, drawingNo: e.target.value })} />
          <input className="mobile-input" placeholder="Element name" value={form.elementName} onChange={(e) => setForm({ ...form, elementName: e.target.value })} />
          <textarea className="mobile-textarea" placeholder="GO details / location trace" value={form.goDetails} onChange={(e) => setForm({ ...form, goDetails: e.target.value })} />
          <textarea className="mobile-textarea" placeholder="Comments" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} />
        </div>
        <div className="mobile-card mobile-card-pad">
          <div className="mobile-chip">Step 3</div>
          <h3 className="mobile-title" style={{ marginTop: 8 }}>Linked checklist</h3>
          <p className="mobile-subtitle">{relatedIds.length} previous checklist selected.</p>
          <button className="mobile-button secondary" type="button" disabled={!form.epsNodeId} onClick={() => setActiveSheet("related")}>
            Link previous checklist
          </button>
        </div>
        <div className="mobile-card mobile-card-pad">
          <div className="mobile-chip">Step 4</div>
          <h3 className="mobile-title" style={{ marginTop: 8 }}>Attachments</h3>
          <label className="mobile-button secondary">
            <Camera size={18} /> Add image/PDF
            <input hidden type="file" accept="image/*,.pdf" capture="environment" onChange={(e) => e.target.files?.[0] && uploadDraft(e.target.files[0])} />
          </label>
          {drafts.map((draft) => <p key={draft.id} className="mobile-subtitle">{draft.originalName}</p>)}
        </div>
        {message && <div className={message.includes("success") ? "mobile-chip" : "mobile-chip danger"}>{message}</div>}
        {canRaiseInspection && (
          <button className="mobile-button" onClick={submit} disabled={submitting}>{submitting ? "Submitting..." : "Submit RFI"}</button>
        )}
      </div>
      {activeSheet === "location" && (
        <MobileSheet title="Select location" onClose={() => setActiveSheet(null)}>
          <div className="mobile-stack">
            <input className="mobile-input" placeholder="Search floor, unit, room" value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} />
            {locationSearch.trim() ? (
              filteredLocations.map((location) => (
                <button
                  className="mobile-card mobile-card-pad mobile-row"
                  key={location.id}
                  type="button"
                  onClick={() => {
                    setForm((current) => ({ ...current, epsNodeId: String(location.id) }));
                    setActiveSheet(null);
                  }}
                >
                  <span>
                    <strong>{location.name}</strong>
                    <span className="mobile-subtitle" style={{ display: "block" }}>{location.type}</span>
                  </span>
                  <span className="mobile-chip">Select</span>
                </button>
              ))
            ) : (
              <div className="mobile-tree-list">
                {locationRoots.map((node) => (
                  <MobileLocationPickerTree
                    key={node.id}
                    node={node}
                    childrenMap={locationChildrenMap}
                    selectedId={form.epsNodeId}
                    onSelect={(location) => {
                      setForm((current) => ({ ...current, epsNodeId: String(location.id) }));
                      setActiveSheet(null);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </MobileSheet>
      )}
      {activeSheet === "activity" && (
        <MobileSheet title="Select checklist activity" onClose={() => setActiveSheet(null)}>
          <div className="mobile-stack">
            <input className="mobile-input" placeholder="Search checklist/activity" value={activitySearch} onChange={(event) => setActivitySearch(event.target.value)} />
            {groupedActivities.map((group) => (
              <details className="mobile-tree-node mobile-activity-tree" key={group.key} open={Boolean(activitySearch.trim())}>
                <summary title={group.listName}>
                  <span>
                    <ListChecks size={15} />
                    <strong>{group.listName}</strong>
                    <small>{group.activities.length} activity option(s)</small>
                  </span>
                  <small>Open</small>
                </summary>
                <div className="mobile-tree-children">
                  {group.activities.map((activity) => (
                    <button
                      className="mobile-picker-child"
                      key={`${activity.listId}-${activity.id}`}
                      type="button"
                      onClick={() => {
                        setForm((current) => ({ ...current, activityId: String(activity.id), listId: String(activity.listId) }));
                        setActiveSheet(null);
                      }}
                    >
                      <strong>{activity.name}</strong>
                      <small>
                        {activity.applicabilityLevel || "FLOOR"}
                        {activity.requiresPourCard ? " / Pour card" : ""}
                        {activity.requiresPourClearanceCard ? " / Clearance" : ""}
                      </small>
                    </button>
                  ))}
                </div>
              </details>
            ))}
            {groupedActivities.length === 0 && (
              <div className="mobile-card mobile-empty">No checklist activity found.</div>
            )}
          </div>
        </MobileSheet>
      )}
      {activeSheet === "related" && (
        <MobileSheet title="Link previous checklist" onClose={() => setActiveSheet(null)}>
          <div className="mobile-stack">
            {relatedOptions.length === 0 && <div className="mobile-card mobile-empty">No related checklist found for this location.</div>}
            {relatedOptions.map((group) => (
              <div className="mobile-card mobile-card-pad" key={`${group.checklistId}-${group.activityId}`}>
                <h3 className="mobile-title">{group.checklistName || group.listName}</h3>
                <p className="mobile-subtitle">{group.activityName}</p>
                {(group.children || []).map((child: AnyRecord) => {
                  const id = Number(child.inspectionId || child.id);
                  const selected = relatedIds.includes(id);
                  return (
                    <div className="mobile-related-row" key={id}>
                      <button
                        className={selected ? "mobile-button" : "mobile-button secondary"}
                        type="button"
                        onClick={() =>
                          setRelatedIds((current) =>
                            selected ? current.filter((value) => value !== id) : [...current, id],
                          )
                        }
                      >
                        {selected ? "Linked" : "Link"} {child.rfiNumber || `RFI #${id}`} / {child.goLabel}
                      </button>
                      <button className="mobile-icon-button" type="button" onClick={() => openRelatedPreview(child)} title="Preview linked checklist">
                        <Search size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </MobileSheet>
      )}
      {previewRelated && (
        <MobileSheet title={previewRelated.rfiNumber || `RFI #${previewRelated.inspectionId || previewRelated.id}`} onClose={() => setPreviewRelated(null)}>
          <div className="mobile-stack">
            <div className="mobile-card mobile-card-pad">
              <span className={statusChipClass(previewRelated.status)}>{previewRelated.status || "RFI"}</span>
              <h3 className="mobile-title" style={{ marginTop: 8 }}>{previewRelated.activityName || selectedActivity?.name || "Checklist"}</h3>
              <p className="mobile-subtitle">{previewRelated.goLabel || "GO"} / {previewRelated.goDetails || "No GO details"}</p>
              <p className="mobile-subtitle">Element: {previewRelated.elementName || "Not set"}</p>
              <p className="mobile-subtitle">Drawing: {previewRelated.drawingNo || "Not set"}</p>
            </div>
            <h3 className="mobile-section-title">Reference Attachments</h3>
            {previewAttachments.length === 0 && <div className="mobile-card mobile-empty">No attachments found.</div>}
            <div className="mobile-attachment-grid">
              {previewAttachments.map((file) => (
                <a key={file.id} className="mobile-attachment-tile" href={getPublicFileUrl(file.annotatedUrl || file.originalUrl)} target="_blank" rel="noreferrer">
                  {String(file.mimeType || "").startsWith("image/") ? (
                    <img src={getPublicFileUrl(file.annotatedUrl || file.originalUrl)} alt={file.originalName || "Attachment"} />
                  ) : (
                    <Paperclip size={22} />
                  )}
                  <span>{file.originalName || "Attachment"}</span>
                </a>
              ))}
            </div>
          </div>
        </MobileSheet>
      )}
    </MobileShell>
  );
}

function InspectionDetailPage() {
  const { inspectionId } = useParams();
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [attachments, setAttachments] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inspectionId) return;
    Promise.allSettled([
      api.get(`/quality/inspections/${inspectionId}`),
      qualityService.getInspectionAttachments(Number(inspectionId)),
    ]).then(([inspectionRes, attachmentRes]) => {
      if (inspectionRes.status === "fulfilled") setDetail(inspectionRes.value.data);
      if (attachmentRes.status === "fulfilled") setAttachments(attachmentRes.value);
      setLoading(false);
    });
  }, [inspectionId]);

  return (
    <MobileShell title={detail?.rfiNumber || `RFI #${inspectionId}`} subtitle={detail?.status || "Checklist detail"}>
      <div className="mobile-stack">
        {loading && <LoadingCard label="Loading RFI..." />}
        {detail && (
          <>
            <div className="mobile-card mobile-card-pad">
              <span className={statusChipClass(detail.status)}>{detail.status}</span>
              <h2 className="mobile-title" style={{ marginTop: 10 }}>{detail.activityName || detail.checklistName || "Inspection"}</h2>
              <p className="mobile-subtitle">{detail.goLabel || detail.goName} · {detail.elementName || "Element not set"}</p>
              <p className="mobile-subtitle">GO details: {detail.goDetails || "Not entered"}</p>
              <p className="mobile-subtitle">Raised by: {pickName(detail.raisedBy || detail.createdByUser)}</p>
            </div>
            <div className="mobile-card mobile-card-pad">
              <h3 className="mobile-title">Linked checklists</h3>
              {(detail.relatedChecklistInspections || []).length === 0 && <p className="mobile-subtitle">No linked checklist.</p>}
              {(detail.relatedChecklistInspections || []).map((item: AnyRecord) => (
                <p key={item.id || item.inspectionId} className="mobile-subtitle">{item.rfiNumber || `RFI #${item.id || item.inspectionId}`} · {item.goLabel}</p>
              ))}
            </div>
            <div className="mobile-card mobile-card-pad">
              <h3 className="mobile-title">Attachments</h3>
              {attachments.length === 0 && <p className="mobile-subtitle">No attachments.</p>}
              {attachments.map((file) => (
                <a key={file.id} className="mobile-button secondary" href={getPublicFileUrl(file.annotatedUrl || file.originalUrl)} target="_blank" rel="noreferrer">
                  Open {file.originalName || "Attachment"}
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function InspectionDetailPageFull() {
  const { inspectionId } = useParams();
  const { projectId } = useParams();
  const { user, hasPermission } = useAuth();
  const [detail, setDetail] = useState<AnyRecord | null>(null);
  const [workflow, setWorkflow] = useState<AnyRecord | null>(null);
  const [attachments, setAttachments] = useState<AnyRecord[]>([]);
  const [observations, setObservations] = useState<AnyRecord[]>([]);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailTab, setDetailTab] = useState<"checklist" | "observations" | "attachments">("checklist");
  const [actionMessage, setActionMessage] = useState("");
  const [observationText, setObservationText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [stageToApprove, setStageToApprove] = useState<AnyRecord | null>(null);
  const [linkedPreview, setLinkedPreview] = useState<AnyRecord | null>(null);
  const [linkedPreviewAttachments, setLinkedPreviewAttachments] = useState<AnyRecord[]>([]);
  const [linkedPreviewObservations, setLinkedPreviewObservations] = useState<AnyRecord[]>([]);

  const activeStage = useMemo(() => {
    const stages = detail?.stages || [];
    return (
      stages.find((stage: AnyRecord) =>
        !["APPROVED", "COMPLETED"].includes(String(stage.status || "").toUpperCase()),
      ) || stages[0]
    );
  }, [detail]);
  const canUpdateInspection = hasPermission(PermissionCode.QUALITY_INSPECTION_UPDATE);
  const canApproveInspection = hasAnyPermission(hasPermission, [
    PermissionCode.QUALITY_INSPECTION_APPROVE,
    PermissionCode.QUALITY_INSPECTION_STAGE_APPROVE,
    PermissionCode.QUALITY_INSPECTION_FINAL_APPROVE,
  ]);
  const canRejectInspection = hasPermission(PermissionCode.QUALITY_INSPECTION_APPROVE);
  const canRaiseChecklistObservation = hasPermission(PermissionCode.QUALITY_OBSERVATION_CREATE);
  const canCloseChecklistObservation = hasPermission(PermissionCode.QUALITY_OBSERVATION_CLOSE);

  const loadDetail = async () => {
    if (!inspectionId) return;
    setLoading(true);
    const [inspectionRes, attachmentRes, workflowRes] = await Promise.allSettled([
      api.get(`/quality/inspections/${inspectionId}`),
      qualityService.getInspectionAttachments(Number(inspectionId)),
      api.get(`/quality/inspections/${inspectionId}/workflow`),
    ]);
    let nextDetail: AnyRecord | null = null;
    if (inspectionRes.status === "fulfilled") {
      nextDetail = inspectionRes.value.data;
      setDetail(nextDetail);
    }
    if (attachmentRes.status === "fulfilled") setAttachments(attachmentRes.value);
    if (workflowRes.status === "fulfilled") setWorkflow(workflowRes.value.data);
    if (nextDetail?.activityId) {
      try {
        const obsRes = await api.get(`/quality/activities/${nextDetail.activityId}/observations`, {
          params: { inspectionId: nextDetail.id },
        });
        setObservations(obsRes.data || []);
      } catch {
        setObservations([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDetail();
  }, [inspectionId]);

  useEffect(() => {
    if (detail) {
      rememberRecentInspection(detail, projectId);
    }
  }, [detail, projectId]);

  useEffect(() => {
    api
      .get("/users/me/signature")
      .then((res) => setSignatureData(res.data?.signatureData || null))
      .catch(() => setSignatureData(null));
  }, []);

  const itemIsChecked = (item: AnyRecord) =>
    item.value === "YES" || item.value === "NA" || item.isOk === true;

  const updateItemValue = (stageId: number, itemId: number, value: string) => {
    setDetail((current) => {
      if (!current) return current;
      return {
        ...current,
        stages: (current.stages || []).map((stage: AnyRecord) =>
          Number(stage.id) === Number(stageId)
            ? {
                ...stage,
                items: (stage.items || []).map((item: AnyRecord) =>
                  Number(item.id) === Number(itemId)
                    ? {
                        ...item,
                        value: item.value === value ? "" : value,
                        isOk: item.value === value ? false : true,
                      }
                    : item,
                ),
              }
            : stage,
        ),
      };
    });
  };

  const updateItemRemarks = (stageId: number, itemId: number, remarks: string) => {
    setDetail((current) => {
      if (!current) return current;
      return {
        ...current,
        stages: (current.stages || []).map((stage: AnyRecord) =>
          Number(stage.id) === Number(stageId)
            ? {
                ...stage,
                items: (stage.items || []).map((item: AnyRecord) =>
                  Number(item.id) === Number(itemId) ? { ...item, remarks } : item,
                ),
              }
            : stage,
        ),
      };
    });
  };

  const saveStage = async (stage: AnyRecord) => {
    if (!inspectionId || !stage?.id) return;
    const checkedCount = (stage.items || []).filter(itemIsChecked).length;
    const totalCount = (stage.items || []).length;
    const status =
      checkedCount === totalCount && totalCount > 0
        ? "COMPLETED"
        : checkedCount > 0
          ? "IN_PROGRESS"
          : stage.status || "PENDING";
    try {
      await api.patch(`/quality/inspections/${inspectionId}/stages/${stage.id}`, {
        status,
        items: (stage.items || []).map((item: AnyRecord) => ({
          id: item.id,
          value: item.value,
          isOk: itemIsChecked(item),
          remarks: item.remarks,
        })),
      });
      setActionMessage("Checklist stage saved.");
      await loadDetail();
    } catch (err: any) {
      setActionMessage(err.response?.data?.message || "Failed to save checklist stage.");
      throw err;
    }
  };

  const approveStage = async (stage: AnyRecord = activeStage) => {
    if (!inspectionId || !stage?.id) {
      setActionMessage("No active checklist stage found for approval.");
      return;
    }
    if (!signatureData) {
      setActionMessage("No saved profile signature found. Upload your signature in Profile before approving.");
      return;
    }
    try {
      await saveStage(stage);
      await api.post(`/quality/inspections/${inspectionId}/stages/${stage.id}/approve`, {
        signatureData,
        comments: "Approved from mobile web",
        signatureEvidence: {
          mode: "MOBILE_WEB_PROFILE",
          source: "mobile-web",
          signedByUserId: user?.id,
          signedByUsername: user?.username,
          signedByDisplayName: user?.displayName || user?.username,
          signedByDesignation: user?.designation,
          userAgent: navigator.userAgent,
          capturedAt: new Date().toISOString(),
        },
      });
      setActionMessage("Approval submitted.");
      await loadDetail();
    } catch (err: any) {
      setActionMessage(
        err.response?.data?.message ||
          "Approval failed. Signature, checklist, or observation closure may be required.",
      );
    }
  };

  const rejectWorkflow = async () => {
    if (!inspectionId || !rejectReason.trim()) {
      setActionMessage("Reject reason is mandatory.");
      return;
    }
    try {
      await api.post(`/quality/inspections/${inspectionId}/workflow/reject`, {
        comments: rejectReason.trim(),
      });
      setActionMessage("RFI rejected.");
      await loadDetail();
    } catch (err: any) {
      setActionMessage(err.response?.data?.message || "Reject failed.");
    }
  };

  const raiseChecklistObservation = async () => {
    if (!detail?.activityId || !observationText.trim()) return;
    try {
      await api.post(`/quality/activities/${detail.activityId}/observation`, {
        inspectionId: detail.id,
        stageId: activeStage?.id || null,
        observationText: observationText.trim(),
        observationRating: "MINOR",
      });
      setObservationText("");
      setActionMessage("Observation raised.");
      await loadDetail();
    } catch (err: any) {
      setActionMessage(err.response?.data?.message || "Observation failed.");
    }
  };

  const closeObservation = async (obsId: number) => {
    if (!detail?.activityId) return;
    try {
      await api.patch(`/quality/activities/${detail.activityId}/observation/${obsId}/close`, {
        closureNotes: "Closed from mobile web",
      });
      setActionMessage("Observation closed.");
      await loadDetail();
    } catch (err: any) {
      setActionMessage(err.response?.data?.message || "Close observation failed.");
    }
  };

  const openLinkedChecklistPreview = async (item: AnyRecord) => {
    const id = Number(item.inspectionId || item.id);
    if (!id) return;
    setLinkedPreview(item);
    setLinkedPreviewAttachments([]);
    setLinkedPreviewObservations([]);
    try {
      const [detailRes, attachmentRes] = await Promise.allSettled([
        api.get(`/quality/inspections/${id}`),
        qualityService.getInspectionAttachments(id),
      ]);
      const detailData = detailRes.status === "fulfilled" ? detailRes.value.data : item;
      setLinkedPreview({ ...item, ...detailData });
      if (attachmentRes.status === "fulfilled") setLinkedPreviewAttachments(attachmentRes.value);
      if (detailData?.activityId) {
        try {
          const obsRes = await api.get(`/quality/activities/${detailData.activityId}/observations`, {
            params: { inspectionId: id },
          });
          setLinkedPreviewObservations(obsRes.data || []);
        } catch {
          setLinkedPreviewObservations([]);
        }
      }
    } catch {
      setLinkedPreview(item);
    }
  };

  return (
    <MobileShell title={detail?.rfiNumber || `RFI #${inspectionId}`} subtitle={detail?.status || "Checklist detail"}>
      <div className="mobile-stack">
        {loading && <LoadingCard label="Loading RFI..." />}
        {detail && (
          <>
            <div className="mobile-card mobile-card-pad">
              <span className={statusChipClass(detail.status)}>{detail.status}</span>
              <h2 className="mobile-title" style={{ marginTop: 10 }}>{detail.activityName || detail.checklistName || "Inspection"}</h2>
              <p className="mobile-subtitle">{detail.goLabel || detail.goName || "GO"} / {detail.elementName || "Element not set"}</p>
              <p className="mobile-subtitle">GO details: {detail.goDetails || "Not entered"}</p>
              <p className="mobile-subtitle">Drawing: {detail.drawingNo || "Not entered"}</p>
              <p className="mobile-subtitle">Raised by: {pickName(detail.raisedBy || detail.createdByUser)}</p>
              <p className="mobile-subtitle">Workflow: {workflow?.status || "Not started"} {workflow?.currentStepOrder ? `/ Level ${workflow.currentStepOrder}` : ""}</p>
              {isRejectedInspection(detail) && (
                <Link
                  className="mobile-button danger"
                  style={{ marginTop: 10 }}
                  to={`/m/projects/${projectId}/quality/requests/new?epsNodeId=${detail.epsNodeId || detail.locationId || ""}&activityId=${detail.activityId || ""}&listId=${detail.listId || detail.activityListId || ""}`}
                >
                  Re-raise corrected RFI
                </Link>
              )}
              <div className={signatureData ? "mobile-signature-ready" : "mobile-signature-missing"}>
                <span>{signatureData ? "Profile signature ready" : "Profile signature missing"}</span>
                <small>{signatureData ? "Approval will use saved signature with logged user/session evidence." : "Open Profile and upload/draw signature before approving."}</small>
              </div>
            </div>

            {(detail.requiresPourCard || detail.requiresPourClearanceCard || detail.activity?.requiresPourCard || detail.activity?.requiresPourClearanceCard) && (
              <div className="mobile-card mobile-card-pad mobile-concrete-card">
                <h3 className="mobile-title">Concrete Documents</h3>
                <p className="mobile-subtitle">Open and complete the required pour documents before final approval.</p>
                <div className="mobile-action-row">
                  {(detail.requiresPourCard || detail.activity?.requiresPourCard) && (
                    <Link className="mobile-button secondary" to={`/m/projects/${projectId}/quality/inspections/${inspectionId}/pour-card`}>
                      Pour Card
                    </Link>
                  )}
                  {(detail.requiresPourClearanceCard || detail.activity?.requiresPourClearanceCard) && (
                    <Link className="mobile-button secondary" to={`/m/projects/${projectId}/quality/inspections/${inspectionId}/pre-pour-clearance`}>
                      Pre-Pour Clearance
                    </Link>
                  )}
                </div>
              </div>
            )}

            <div className="mobile-pill-tabs">
              <button className={detailTab === "checklist" ? "active" : ""} type="button" onClick={() => setDetailTab("checklist")}>Checklist</button>
              <button className={detailTab === "observations" ? "active" : ""} type="button" onClick={() => setDetailTab("observations")}>Observations</button>
              <button className={detailTab === "attachments" ? "active" : ""} type="button" onClick={() => setDetailTab("attachments")}>Attachments</button>
            </div>

            {detailTab === "checklist" && (
              <>
                {(detail.stages || []).length === 0 ? (
                  <div className="mobile-card mobile-empty">No checklist stages are assigned to this RFI.</div>
                ) : (
                  (detail.stages || []).map((stage: AnyRecord, index: number) => {
                    const items = [...(stage.items || [])].sort(
                      (a: AnyRecord, b: AnyRecord) =>
                        Number(a.itemTemplate?.sequence || a.sequence || 0) -
                        Number(b.itemTemplate?.sequence || b.sequence || 0),
                    );
                    const checked = items.filter(itemIsChecked).length;
                    const stageApproval = stage.stageApproval || {};
                    const levels = stageApproval.levels || [];
                    return (
                      <details className="mobile-stage-card" key={stage.id || index} open={index === 0}>
                        <summary>
                          <div>
                            <span className={statusChipClass(stageApproval.fullyApproved ? "APPROVED" : stage.status)}>{stageApproval.fullyApproved ? "Approved" : stage.status || "Pending"}</span>
                            <h3>Stage {index + 1}: {stage.stageTemplate?.name || stage.name || "General Checks"}</h3>
                            <p>{checked}/{items.length} checklist items complete</p>
                            {stageApproval.pendingDisplay && <p>Pending: {stageApproval.pendingDisplay}</p>}
                          </div>
                          <ChevronRight size={18} />
                        </summary>

                        {levels.length > 0 && (
                          <div className="mobile-stage-levels">
                            {levels.map((level: AnyRecord) => (
                              <div key={`${stage.id}-${level.stepOrder}`} className={level.approved ? "approved" : ""}>
                                <strong>L{level.stepOrder}</strong>
                                <span>{level.approved ? level.signerDisplayName || "Approved" : level.stepName || "Pending"}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mobile-check-items">
                          {items.map((item: AnyRecord, itemIndex: number) => (
                            <div className="mobile-check-item" key={item.id || itemIndex}>
                              <div className="mobile-row">
                                <span className="mobile-check-index">{itemIndex + 1}</span>
                                <p>{item.itemTemplate?.itemText || item.itemText || item.description || "Checklist item"}</p>
                              </div>
                              <div className="mobile-check-actions">
                                <button className={item.value === "YES" || (item.isOk && item.value !== "NA") ? "active" : ""} type="button" onClick={() => updateItemValue(Number(stage.id), Number(item.id), "YES")}>
                                  YES
                                </button>
                                <button className={item.value === "NA" ? "active warn" : ""} type="button" onClick={() => updateItemValue(Number(stage.id), Number(item.id), "NA")}>
                                  NA
                                </button>
                              </div>
                              <input
                                className="mobile-input"
                                placeholder="Remarks"
                                value={item.remarks || ""}
                                onChange={(event) => updateItemRemarks(Number(stage.id), Number(item.id), event.target.value)}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="mobile-action-row">
                          {canUpdateInspection && (
                            <button className="mobile-button secondary" type="button" onClick={() => saveStage(stage)}>Save Stage</button>
                          )}
                          {canApproveInspection && (
                            <button className="mobile-button" type="button" onClick={() => setStageToApprove(stage)}>Approve Stage</button>
                          )}
                          <button className="mobile-button secondary" type="button" onClick={() => setDetailTab("observations")}>Observations ({observations.filter((obs) => Number(obs.stageId) === Number(stage.id)).length})</button>
                        </div>
                      </details>
                    );
                  })
                )}

                {canRejectInspection && (
                <div className="mobile-card mobile-card-pad">
                  <h3 className="mobile-title">Reject RFI</h3>
                  <textarea
                    className="mobile-textarea"
                    placeholder="Reject reason mandatory for rejection"
                    value={rejectReason}
                    onChange={(event) => setRejectReason(event.target.value)}
                  />
                  <button className="mobile-button danger" type="button" onClick={rejectWorkflow}>Reject</button>
                  {actionMessage && (
                    <div className={actionMessage.includes("failed") || actionMessage.includes("mandatory") ? "mobile-chip danger" : "mobile-chip"}>
                      {actionMessage}
                    </div>
                  )}
                </div>
                )}
              </>
            )}

            {detailTab === "observations" && (
              <div className="mobile-card mobile-card-pad">
              <h3 className="mobile-title">Checklist observations</h3>
              {canRaiseChecklistObservation && (
                <>
                  <textarea
                    className="mobile-textarea"
                    placeholder="Raise checklist observation"
                    value={observationText}
                    onChange={(event) => setObservationText(event.target.value)}
                  />
                  <button className="mobile-button secondary" type="button" onClick={raiseChecklistObservation}>
                    Raise observation
                  </button>
                </>
              )}
              {observations.length === 0 && <p className="mobile-subtitle">No observations.</p>}
              {observations.map((obs) => (
                <div key={obs.id} className="mobile-card mobile-card-pad" style={{ marginTop: 10 }}>
                  <span className={statusChipClass(obs.status || obs.observationRating)}>{obs.observationRating || obs.status || "Observation"}</span>
                  <p className="mobile-subtitle">{obs.observationText || obs.description}</p>
                  <p className="mobile-subtitle">Raised by {pickName(obs.raisedBy)} - {dateText(obs.createdAt)}</p>
                  {evidencePhotos(obs).length > 0 && (
                    <div className="mobile-photo-strip">
                      {evidencePhotos(obs).map((photo, index) => (
                        <img key={`${obs.id}-photo-${index}`} src={getPublicFileUrl(photo)} alt="Checklist observation evidence" />
                      ))}
                    </div>
                  )}
                  {canCloseChecklistObservation && String(obs.status || "").toUpperCase() !== "CLOSED" && (
                    <button className="mobile-button secondary" type="button" onClick={() => closeObservation(Number(obs.id))}>
                      Close observation
                    </button>
                  )}
                </div>
              ))}
              </div>
            )}

            {detailTab === "checklist" && (
              <div className="mobile-card mobile-card-pad">
              <h3 className="mobile-title">Linked checklists</h3>
              {(detail.relatedChecklistInspections || []).length === 0 && <p className="mobile-subtitle">No linked checklist.</p>}
              {(detail.relatedChecklistInspections || []).map((item: AnyRecord) => (
                <button
                  key={item.id || item.inspectionId}
                  className="mobile-linked-card"
                  type="button"
                  onClick={() => openLinkedChecklistPreview(item)}
                >
                  <div>
                    <strong>{item.rfiNumber || `RFI #${item.id || item.inspectionId}`}</strong>
                    <small>{item.activityName || item.checklistName || "Linked checklist"} / {item.goLabel || item.goName || "GO"}</small>
                    <small>{item.elementName || item.goDetails || item.drawingNo || "Tap to inspect checklist evidence"}</small>
                  </div>
                  <ChevronRight size={17} />
                </button>
              ))}
              </div>
            )}

            {detailTab === "attachments" && (
              <div className="mobile-card mobile-card-pad">
              <h3 className="mobile-title">Attachments</h3>
              {attachments.length === 0 && <p className="mobile-subtitle">No attachments.</p>}
              <div className="mobile-attachment-grid">
                {attachments.map((file) => (
                  <a key={file.id} className="mobile-attachment-tile" href={getPublicFileUrl(file.annotatedUrl || file.originalUrl)} target="_blank" rel="noreferrer">
                    {String(file.mimeType || "").startsWith("image/") ? (
                      <img src={getPublicFileUrl(file.annotatedUrl || file.originalUrl)} alt={file.originalName || "Attachment"} />
                    ) : (
                      <Paperclip size={22} />
                    )}
                    <span>{file.originalName || "Attachment"}</span>
                  </a>
                ))}
              </div>
              </div>
            )}

            {stageToApprove && (
              <MobileSheet title="Confirm Stage Approval" onClose={() => setStageToApprove(null)}>
                <div className="mobile-stack">
                  <div className="mobile-card mobile-card-pad">
                    <span className={signatureData ? "mobile-chip" : "mobile-chip danger"}>
                      {signatureData ? "Signature ready" : "Signature missing"}
                    </span>
                    <h3 className="mobile-title" style={{ marginTop: 8 }}>
                      {stageToApprove.stageTemplate?.name || stageToApprove.name || "Checklist Stage"}
                    </h3>
                    <p className="mobile-subtitle">
                      Approval will be recorded with your login identity, saved profile signature, browser evidence, and backend request metadata.
                    </p>
                  </div>
                  {signatureData && (
                    <img className="mobile-signature-preview" src={signatureData} alt="Saved signature preview" />
                  )}
                  <div className="mobile-action-row">
                    <button
                      className="mobile-button"
                      type="button"
                      onClick={async () => {
                        const stage = stageToApprove;
                        setStageToApprove(null);
                        await approveStage(stage);
                      }}
                    >
                      Confirm Approve
                    </button>
                    <button className="mobile-button secondary" type="button" onClick={() => setStageToApprove(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </MobileSheet>
            )}
            {linkedPreview && (
              <MobileSheet title={linkedPreview.rfiNumber || `RFI #${linkedPreview.id || linkedPreview.inspectionId}`} onClose={() => setLinkedPreview(null)}>
                <div className="mobile-stack">
                  <div className="mobile-card mobile-card-pad">
                    <span className={statusChipClass(linkedPreview.status)}>{linkedPreview.status || "Linked RFI"}</span>
                    <h3 className="mobile-title" style={{ marginTop: 8 }}>{linkedPreview.activityName || linkedPreview.checklistName || "Checklist"}</h3>
                    <p className="mobile-subtitle">{linkedPreview.goLabel || linkedPreview.goName || "GO"} / {linkedPreview.elementName || "Element not set"}</p>
                    <p className="mobile-subtitle">GO details: {linkedPreview.goDetails || "Not entered"}</p>
                    <p className="mobile-subtitle">Drawing: {linkedPreview.drawingNo || "Not entered"}</p>
                    <p className="mobile-subtitle">Raised by: {pickName(linkedPreview.raisedBy || linkedPreview.createdByUser)}</p>
                  </div>
                  {(linkedPreview.stages || []).length > 0 && (
                    <div className="mobile-card mobile-card-pad">
                      <h3 className="mobile-title">Checklist responses</h3>
                      {(linkedPreview.stages || []).map((stage: AnyRecord, stageIndex: number) => (
                        <div className="mobile-history-row" key={stage.id || stageIndex}>
                          <span className={statusChipClass(stage.status)}>{stage.status || "Stage"}</span>
                          <p>{stage.stageTemplate?.name || stage.name || `Stage ${stageIndex + 1}`}</p>
                          <small>{(stage.items || []).filter(itemIsChecked).length}/{(stage.items || []).length} completed</small>
                        </div>
                      ))}
                    </div>
                  )}
                  {linkedPreviewObservations.length > 0 && (
                    <div className="mobile-card mobile-card-pad">
                      <h3 className="mobile-title">Observations</h3>
                      {linkedPreviewObservations.map((obs) => (
                        <div className="mobile-history-row" key={obs.id}>
                          <span className={statusChipClass(obs.status || obs.observationRating)}>{obs.observationRating || obs.status || "Observation"}</span>
                          <p>{obs.observationText || obs.description}</p>
                          <small>{actorLine("Raised", obs.raisedBy || obs.inspectorId, obs.createdAt)}</small>
                          {evidencePhotos(obs).length > 0 && (
                            <div className="mobile-photo-strip">
                              {evidencePhotos(obs).map((photo, index) => (
                                <img key={`${obs.id}-${index}`} src={getPublicFileUrl(photo)} alt="Linked observation evidence" />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {linkedPreviewAttachments.length > 0 && (
                    <div className="mobile-attachment-grid">
                      {linkedPreviewAttachments.map((file) => (
                        <a key={file.id} className="mobile-attachment-tile" href={getPublicFileUrl(file.annotatedUrl || file.originalUrl)} target="_blank" rel="noreferrer">
                          {String(file.mimeType || "").startsWith("image/") ? (
                            <img src={getPublicFileUrl(file.annotatedUrl || file.originalUrl)} alt={file.originalName || "Attachment"} />
                          ) : (
                            <Paperclip size={22} />
                          )}
                          <span>{file.originalName || "Attachment"}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </MobileSheet>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
}

function MobileConcreteDocumentPage({ type }: { type: "pour" | "clearance" }) {
  const { projectId, inspectionId } = useParams();
  const { hasPermission } = useAuth();
  const [card, setCard] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const isPour = type === "pour";
  const canSubmitDocument = isPour
    ? hasPermission(PermissionCode.QUALITY_POUR_CARD_SUBMIT)
    : hasPermission(PermissionCode.QUALITY_POUR_CLEARANCE_SUBMIT);
  const canApproveDocument = isPour
    ? hasPermission(PermissionCode.QUALITY_POUR_CARD_APPROVE)
    : hasPermission(PermissionCode.QUALITY_POUR_CLEARANCE_APPROVE);

  const load = async () => {
    if (!inspectionId) return;
    setLoading(true);
    try {
      const data = isPour
        ? await qualityService.getPourCard(Number(inspectionId))
        : await qualityService.getPrePourClearanceCard(Number(inspectionId));
      setCard(data || {});
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Unable to load document.");
      setCard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [inspectionId, type]);

  const submit = async () => {
    if (!inspectionId) return;
    try {
      const data = isPour
        ? await qualityService.submitPourCard(Number(inspectionId))
        : await qualityService.submitPrePourClearanceCard(Number(inspectionId));
      setCard(data);
      setMessage("Submitted for approval.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Submit failed.");
    }
  };

  const approve = async () => {
    if (!inspectionId) return;
    try {
      const data = isPour
        ? await qualityService.approvePourCard(Number(inspectionId), "Approved from mobile web")
        : await qualityService.approvePrePourClearanceCard(Number(inspectionId), "Approved from mobile web");
      setCard(data);
      setMessage("Document approved.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Approval failed.");
    }
  };

  const reject = async () => {
    if (!inspectionId) return;
    const remarks = window.prompt("Reason for rejection");
    if (!remarks) return;
    try {
      const data = isPour
        ? await qualityService.rejectPourCard(Number(inspectionId), remarks)
        : await qualityService.rejectPrePourClearanceCard(Number(inspectionId), remarks);
      setCard(data);
      setMessage("Document rejected.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Reject failed.");
    }
  };

  const status = card?.approvalStatus || card?.status || "DRAFT";
  const importantRows = [
    ["Project", card?.projectNameSnapshot || card?.projectName],
    ["Location", card?.pourLocation || card?.locationText || card?.location],
    ["Contractor", card?.contractorName || card?.contractor],
    ["Pour Date", card?.pourDate],
    ["Concrete Grade", card?.gradeOfConcrete || card?.concreteGrade],
    ["GO Details", card?.goDetails],
  ].filter(([, value]) => value);

  return (
    <MobileShell title={isPour ? "Pour Card" : "Pre-Pour Clearance"} subtitle={`RFI #${inspectionId}`}>
      <div className="mobile-stack">
        {loading && <LoadingCard label="Loading document..." />}
        {message && <div className={message.includes("failed") || message.includes("Unable") ? "mobile-chip danger" : "mobile-chip"}>{message}</div>}
        {card && (
          <>
            <div className="mobile-card mobile-card-pad mobile-concrete-card">
              <span className={statusChipClass(status)}>{status}</span>
              <h2 className="mobile-title" style={{ marginTop: 10 }}>{isPour ? "Concrete Pour Card" : "Pre-Pour Clearance Certificate"}</h2>
              <p className="mobile-subtitle">Mobile view uses the same backend document saved from desktop approval flow.</p>
              <div className="mobile-info-list">
                {importantRows.map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{String(value)}</strong>
                  </div>
                ))}
              </div>
            </div>

            {!isPour && Array.isArray(card.signoffs) && (
              <div className="mobile-card mobile-card-pad">
                <h3 className="mobile-title">Signature List</h3>
                <div className="mobile-stack" style={{ marginTop: 10 }}>
                  {card.signoffs.map((signoff: AnyRecord, index: number) => (
                    <div className="mobile-check-item" key={signoff.id || index}>
                      <span className={statusChipClass(signoff.signedAt ? "APPROVED" : "PENDING")}>{signoff.signedAt ? "Signed" : "Pending"}</span>
                      <p>{signoff.department || signoff.name || `Signoff ${index + 1}`}</p>
                      <p className="mobile-subtitle">{signoff.designation || signoff.signedByDesignation || "Designation not set"}</p>
                      {signoff.signedByName && <p className="mobile-subtitle">By {signoff.signedByName} / {dateText(signoff.signedAt)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mobile-action-row">
              <button className="mobile-button secondary" type="button" onClick={() => window.open(`/api/quality/inspections/${inspectionId}/${isPour ? "pour-card" : "pre-pour-clearance"}/pdf`, "_blank")}>
                PDF
              </button>
              {canSubmitDocument && (
                <button className="mobile-button secondary" type="button" onClick={submit}>Submit</button>
              )}
              {canApproveDocument && (
                <>
                  <button className="mobile-button" type="button" onClick={approve}>Approve</button>
                  <button className="mobile-button danger" type="button" onClick={reject}>Reject</button>
                </>
              )}
              <Link className="mobile-button secondary" to={`/m/projects/${projectId}/quality/inspections/${inspectionId}`}>Back to RFI</Link>
            </div>
          </>
        )}
      </div>
    </MobileShell>
  );
}

function MyTasksPage() {
  const { projectId } = useParams();
  const { items, loading } = useProjectInspections(projectId);
  const [ncrs, setNcrs] = useState<AnyRecord[]>([]);
  const [cubes, setCubes] = useState<AnyRecord[]>([]);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    if (!projectId) return;
    api
      .get(`/quality/${projectId}/observation-ncr`)
      .then((res) => setNcrs((res.data || []).filter((row: AnyRecord) => String(row.type || "").toUpperCase() === "NCR")))
      .catch(() => setNcrs([]));
    qualityService.getCubeTestRegister(Number(projectId)).then(setCubes).catch(() => setCubes([]));
  }, [projectId]);

  const tasks = useMemo(() => {
    const rfiTasks = items
      .filter((item) => isPendingInspection(item) || isRejectedInspection(item))
      .map((item) => ({
        id: `rfi-${item.id}`,
        type: isRejectedInspection(item) ? "REWORK" : "APPROVAL",
        title: item.rfiNumber || `RFI #${item.id}`,
        subtitle: `${item.activityName || "Inspection"} / ${item.goLabel || "GO"} / ${item.pendingApprovalDisplay || item.status}`,
        status: item.status,
        to: `/m/projects/${projectId}/quality/inspections/${item.id}`,
      }));
    const ncrTasks = ncrs
      .filter((item) => !["CLOSED", "CLOSE"].includes(String(item.status || "").toUpperCase()))
      .map((item) => ({
        id: `ncr-${item.id}`,
        type: "NCR",
        title: item.sourceReference || "Quality NCR",
        subtitle: item.description || item.status || "Open NCR",
        status: item.status || "OPEN",
        to: `/m/projects/${projectId}/quality/ncr`,
      }));
    const today = new Date().toISOString().slice(0, 10);
    const cubeTasks = cubes
      .filter((cube) => String(cube.status || "").toUpperCase() !== "APPROVED" && String(cube.dueDate || "").slice(0, 10) <= today)
      .map((cube) => ({
        id: `cube-${cube.id}`,
        type: "CUBE",
        title: cube.cubeId || `Cube #${cube.id}`,
        subtitle: `${cube.mixIdOrGrade || "Grade"} / Due ${dateText(cube.dueDate)}`,
        status: cube.status || "DUE",
        to: `/m/projects/${projectId}/quality/materials/cubes`,
      }));
    return [...rfiTasks, ...ncrTasks, ...cubeTasks];
  }, [items, ncrs, cubes, projectId]);

  const visible = tasks.filter((task) => filter === "ALL" || task.type === filter);

  return (
    <MobileShell title="My Tasks" subtitle="Action inbox">
      <div className="mobile-stack">
        <section className="mobile-hero-card">
          <div className="mobile-row">
            <div>
              <span className="mobile-chip">TASK CENTER</span>
              <h2>{tasks.length}</h2>
              <p>Pending approvals, rework, NCR and due cube tests</p>
            </div>
            <ClipboardList size={34} />
          </div>
        </section>
        <div className="mobile-pill-tabs">
          {["ALL", "APPROVAL", "REWORK", "NCR", "CUBE"].map((key) => (
            <button key={key} className={filter === key ? "active" : ""} type="button" onClick={() => setFilter(key)}>
              {key}
            </button>
          ))}
        </div>
        {loading && <LoadingCard label="Loading task inbox..." />}
        {visible.map((task) => (
          <Link key={task.id} className={`mobile-notification-item ${task.type === "REWORK" || task.type === "NCR" ? "danger" : "warn"}`} to={task.to}>
            <span />
            <div>
              <strong>{task.title}</strong>
              <small>{task.subtitle}</small>
            </div>
            <ChevronRight size={17} />
          </Link>
        ))}
        {!loading && visible.length === 0 && <div className="mobile-card mobile-empty">No tasks in this bucket.</div>}
      </div>
    </MobileShell>
  );
}

function QrEntryPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");

  const openToken = () => {
    const value = token.trim();
    if (!value) {
      setMessage("Paste a QR token or URL first.");
      return;
    }
    try {
      const parsed = new URL(value);
      if (parsed.pathname.startsWith("/m/")) {
        navigate(`${parsed.pathname}${parsed.search}`);
        return;
      }
      const qrToken = parsed.searchParams.get("token") || parsed.pathname.split("/").filter(Boolean).pop();
      if (qrToken) {
        navigate(`/m/signature/confirm?token=${encodeURIComponent(qrToken)}`);
        return;
      }
    } catch {
      navigate(`/m/signature/confirm?token=${encodeURIComponent(value)}`);
      return;
    }
    setMessage("Could not read this QR value.");
  };

  return (
    <MobileShell title="QR Scan" subtitle="Signature and checklist lookup">
      <div className="mobile-stack">
        <section className="mobile-os-hero">
          <div>
            <span>FIELD QR</span>
            <h2>Scan or paste</h2>
            <p>Use camera capture for QR images, paste copied links, or open signature confirmation tokens.</p>
          </div>
        </section>
        <div className="mobile-card mobile-card-pad">
          <h3 className="mobile-title">Camera / QR image</h3>
          <p className="mobile-subtitle">Browser QR decoding will be added as a dedicated scanner engine. For now, paste the decoded token or URL below.</p>
          <label className="mobile-button secondary" style={{ marginTop: 12 }}>
            <Camera size={18} /> Capture QR image
            <input hidden type="file" accept="image/*" capture="environment" onChange={() => setMessage("Image captured. QR decoding engine is pending implementation.")} />
          </label>
        </div>
        <div className="mobile-card mobile-card-pad">
          <h3 className="mobile-title">Paste QR token / URL</h3>
          <textarea className="mobile-textarea" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste token or SETU QR URL" />
          <button className="mobile-button" type="button" onClick={openToken}>Open QR Action</button>
          {message && <div className={message.includes("pending") ? "mobile-chip warn" : "mobile-chip danger"}>{message}</div>}
        </div>
        <div className="mobile-action-grid">
          <Link className="mobile-action-card" to={`/m/projects/${projectId}/quality/approvals`}>
            <ClipboardCheck size={20} />
            <span>Approval QR</span>
            <small>Open pending approvals</small>
          </Link>
          <Link className="mobile-action-card" to="/m/signature/confirm">
            <QrCode size={20} />
            <span>Signature QR</span>
            <small>Confirm a signing request</small>
          </Link>
        </div>
      </div>
    </MobileShell>
  );
}

function QualityObservationsPage({ ncrOnly = false }: { ncrOnly?: boolean }) {
  const { projectId } = useParams();
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [draft, setDraft] = useState<AnyRecord>({});
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!projectId) return;
    const url = ncrOnly ? `/quality/${projectId}/observation-ncr` : "/quality/site-observations";
    api
      .get(url, ncrOnly ? undefined : { params: { projectId } })
      .then((res) => {
        const rows = res.data?.items || res.data || [];
        setItems(ncrOnly ? rows.filter((row: AnyRecord) => String(row.type || "").toUpperCase() === "NCR") : rows);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [projectId, ncrOnly]);

  const openNcrRecord = (item: AnyRecord) => {
    setSelected(item);
    setDraft({
      status: item.status || "Open",
      description: item.description || item.observationText || "",
      rootCause: item.rootCause || "",
      correctiveAction: item.correctiveAction || "",
      preventiveAction: item.preventiveAction || "",
      closureRemarks: item.closureRemarks || "",
    });
  };

  const saveNcrRecord = async () => {
    if (!selected) return;
    try {
      const res = await api.put(`/quality/observation-ncr/${selected.id}`, { ...selected, ...draft });
      setSelected(res.data);
      setItems((current) => current.map((item) => (String(item.id) === String(selected.id) ? res.data : item)));
      setMessage("NCR updated.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "NCR update failed.");
    }
  };

  const deleteNcrRecord = async () => {
    if (!selected || !window.confirm("Delete this NCR record?")) return;
    try {
      await api.delete(`/quality/observation-ncr/${selected.id}`);
      setItems((current) => current.filter((item) => String(item.id) !== String(selected.id)));
      setSelected(null);
      setMessage("NCR deleted.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "NCR delete failed.");
    }
  };

  if (ncrOnly) {
    return (
      <MobileShell title="NC Register" subtitle="Critical/non-conformance records">
        <div className="mobile-stack">
          {message && <div className={message.includes("failed") ? "mobile-chip danger" : "mobile-chip"}>{message}</div>}
          {loading && <LoadingCard />}
          {items.map((item) => (
            <button className="mobile-card mobile-card-pad mobile-observation-card" key={item.id} type="button" onClick={() => openNcrRecord(item)}>
              <div className="mobile-row">
                <div>
                  <span className={statusChipClass(item.status || item.severity || item.observationRating)}>{item.status || item.observationRating || "NCR"}</span>
                  <h3 className="mobile-title" style={{ marginTop: 8 }}>{item.sourceReference || item.title || "NCR"}</h3>
                  <p className="mobile-subtitle">{item.description || item.observationText || "No description"}</p>
                  <p className="mobile-subtitle">Reported by {item.reportedBy || pickName(item.raisedBy || item.createdByUser)}</p>
                </div>
                <ChevronRight size={18} />
              </div>
            </button>
          ))}
          {!loading && items.length === 0 && <div className="mobile-card mobile-empty">No NCR records found.</div>}
          {selected && (
            <MobileSheet title={selected.sourceReference || selected.title || "NCR detail"} onClose={() => setSelected(null)}>
              <div className="mobile-stack">
                <div className="mobile-card mobile-card-pad">
                  <span className={statusChipClass(selected.status || selected.severity || selected.observationRating)}>{selected.status || selected.observationRating || "NCR"}</span>
                  <h3 className="mobile-title" style={{ marginTop: 8 }}>{selected.description || selected.observationText || "NCR"}</h3>
                  <p className="mobile-subtitle">{selected.sourceReference || "Source not set"}</p>
                </div>
                <select className="mobile-select" value={draft.status || ""} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                  <option>Open</option>
                  <option>In Progress</option>
                  <option>Closed</option>
                </select>
                <textarea className="mobile-textarea" placeholder="Description" value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                <textarea className="mobile-textarea" placeholder="Root cause" value={draft.rootCause || ""} onChange={(event) => setDraft({ ...draft, rootCause: event.target.value })} />
                <textarea className="mobile-textarea" placeholder="Corrective action" value={draft.correctiveAction || ""} onChange={(event) => setDraft({ ...draft, correctiveAction: event.target.value })} />
                <textarea className="mobile-textarea" placeholder="Preventive action" value={draft.preventiveAction || ""} onChange={(event) => setDraft({ ...draft, preventiveAction: event.target.value })} />
                <textarea className="mobile-textarea" placeholder="Closure remarks" value={draft.closureRemarks || ""} onChange={(event) => setDraft({ ...draft, closureRemarks: event.target.value })} />
                <div className="mobile-action-row">
                  <button className="mobile-button" type="button" onClick={saveNcrRecord}>Save NCR</button>
                  <button className="mobile-button danger" type="button" onClick={deleteNcrRecord}>Delete</button>
                </div>
              </div>
            </MobileSheet>
          )}
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell title={ncrOnly ? "NC Register" : "Quality Observations"} subtitle={ncrOnly ? "Critical/non-conformance records" : "Site quality observations"}>
      <div className="mobile-stack">
        {loading && <LoadingCard />}
        {items.map((item) => (
          <div className="mobile-card mobile-card-pad" key={item.id}>
            <span className={statusChipClass(item.status || item.severity || item.observationRating)}>{item.observationRating || item.severity || item.status || "Observation"}</span>
            <h3 className="mobile-title" style={{ marginTop: 8 }}>{item.title || item.description || item.observationText || item.sourceReference || "Observation"}</h3>
            <p className="mobile-subtitle">Raised by {pickName(item.raisedBy || item.createdByUser)} · {dateText(item.createdAt)}</p>
            <p className="mobile-subtitle">Rectifier: {pickName(item.rectifiedBy)} · {item.rectifiedAt ? dateText(item.rectifiedAt) : "Pending"}</p>
            <p className="mobile-subtitle">Closer: {pickName(item.closedByUser || item.closedBy)} · {item.closedAt ? dateText(item.closedAt) : "Pending"}</p>
          </div>
        ))}
        {!loading && items.length === 0 && <div className="mobile-card mobile-empty">No records found.</div>}
      </div>
    </MobileShell>
  );
}

function QualityObservationsPageFull() {
  const { projectId } = useParams();
  const { hasPermission } = useAuth();
  const { project, locations } = useProjectLocations(projectId);
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showRaise, setShowRaise] = useState(false);
  const [showObservationLocationPicker, setShowObservationLocationPicker] = useState(false);
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [mode, setMode] = useState<"rectify" | "close" | "reject" | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [actionFiles, setActionFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    epsNodeId: "",
    category: "Structural",
    observationRating: "MINOR",
    description: "",
    remarks: "",
    targetDate: "",
  });
  const [actionText, setActionText] = useState("");
  const observationChildrenMap = useMemo(() => buildChildrenMap(locations), [locations]);
  const observationLocationIds = useMemo(() => new Set(locations.map((node) => node.id)), [locations]);
  const observationLocationRoots = useMemo(
    () => locations.filter((node) => !node.parentId || !observationLocationIds.has(node.parentId)),
    [locations, observationLocationIds],
  );
  const selectedObservationLocation = locations.find((location) => location.id === Number(form.epsNodeId));
  const selectedObservationLocationPath = formatLocationPath(form.epsNodeId, locations, project);
  const canCreateObservation = hasPermission(PermissionCode.QUALITY_SITE_OBS_CREATE);
  const canRectifyObservation = hasPermission(PermissionCode.QUALITY_SITE_OBS_RECTIFY);
  const canCloseObservation = hasPermission(PermissionCode.QUALITY_SITE_OBS_CLOSE);
  const canRejectObservationRectification = hasPermission(PermissionCode.QUALITY_SITE_OBS_REJECT_RECTIFICATION);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await api.get("/quality/site-observations", { params: { projectId } });
      setItems(res.data?.items || res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const create = async () => {
    try {
      const photos = photoFiles.length ? await uploadMobileFiles(photoFiles) : [];
      await api.post("/quality/site-observations", {
        projectId: Number(projectId),
        epsNodeId: form.epsNodeId ? Number(form.epsNodeId) : null,
        locationLabel: selectedObservationLocationPath,
        severity: form.observationRating === "CRITICAL" ? "CRITICAL" : form.observationRating === "OFI" ? "INFO" : form.observationRating,
        observationRating: form.observationRating,
        category: form.category,
        description: form.description,
        remarks: form.remarks,
        targetDate: form.targetDate,
        photos,
      });
      setShowRaise(false);
      setPhotoFiles([]);
      setMessage("Observation raised.");
      await load();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Unable to raise observation.");
    }
  };

  const submitAction = async () => {
    if (!selected || !mode) return;
    if (mode === "reject" && !actionText.trim()) {
      setMessage("Reject reason is mandatory.");
      return;
    }
    try {
      if (mode === "rectify") {
        const rectificationPhotos = actionFiles.length ? await uploadMobileFiles(actionFiles) : [];
        await api.patch(`/quality/site-observations/${selected.id}/rectify`, {
          rectificationText: actionText,
          rectificationPhotos,
        });
      } else if (mode === "close") {
        await api.patch(`/quality/site-observations/${selected.id}/close`, {
          closureRemarks: actionText,
        });
      } else {
        await api.patch(`/quality/site-observations/${selected.id}/reject-rectification`, {
          rejectionRemarks: actionText,
        });
      }
      setSelected(null);
      setMode(null);
      setActionText("");
      setActionFiles([]);
      setMessage("Action saved.");
      await load();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Action failed.");
    }
  };

  return (
    <MobileShell title="Quality Observations" subtitle="Raise, rectify, reject, close">
      <div className="mobile-stack">
        {canCreateObservation && (
          <button className="mobile-button" type="button" onClick={() => setShowRaise(true)}>
            <Plus size={18} /> Raise observation
          </button>
        )}
        {message && <div className={message.includes("failed") || message.includes("mandatory") ? "mobile-chip danger" : "mobile-chip"}>{message}</div>}
        {loading && <LoadingCard />}
        {items.map((item) => (
          <button
            className="mobile-card mobile-card-pad mobile-observation-card"
            key={item.id}
            type="button"
            onClick={() => {
              setSelected(item);
              setMode(null);
              setActionText("");
              setActionFiles([]);
            }}
          >
            <div className="mobile-row">
              <div>
                <span className={statusChipClass(item.status || item.severity || item.observationRating)}>{item.observationRating || item.severity || item.status || "Observation"}</span>
                <h3 className="mobile-title" style={{ marginTop: 8 }}>{item.description || item.observationText || "Observation"}</h3>
                <p className="mobile-subtitle">{actorLine("Raised by", item.raisedBy || item.createdByUser || item.raisedById, item.createdAt)}</p>
                <p className="mobile-subtitle">{item.locationLabel || "Location not set"}</p>
              </div>
              <ChevronRight size={18} />
            </div>
            {evidencePhotos(item).length > 0 && (
              <div className="mobile-photo-strip">
                {evidencePhotos(item).slice(0, 3).map((photo, index) => (
                  <img key={`${item.id}-${index}`} src={getPublicFileUrl(photo)} alt="Observation evidence" />
                ))}
              </div>
            )}
          </button>
        ))}
        {!loading && items.length === 0 && <div className="mobile-card mobile-empty">No observations found.</div>}
      </div>
      {showRaise && (
        <MobileSheet title="Raise quality observation" onClose={() => setShowRaise(false)}>
          <div className="mobile-stack">
            <button className="mobile-button secondary" type="button" onClick={() => setShowObservationLocationPicker(true)}>
              {selectedObservationLocation
                ? `${selectedObservationLocationPath || selectedObservationLocation.name} (${selectedObservationLocation.type})`
                : "Select location from tree"}
            </button>
            <select className="mobile-select" value={form.observationRating} onChange={(event) => setForm({ ...form, observationRating: event.target.value })}>
              <option value="OFI">OFI</option>
              <option value="MINOR">Minor</option>
              <option value="MODERATE">Moderate</option>
              <option value="MAJOR">Major</option>
              <option value="CRITICAL">Critical / NCR</option>
            </select>
            <input className="mobile-input" placeholder="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            <textarea className="mobile-textarea" placeholder="Observation description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <input className="mobile-input" type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} />
            <textarea className="mobile-textarea" placeholder="Remarks" value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} />
            <label className="mobile-button secondary">
              <Camera size={18} /> Add observation photos
              <input hidden type="file" accept="image/*" capture="environment" multiple onChange={(event) => setPhotoFiles(Array.from(event.target.files || []))} />
            </label>
            {photoFiles.length > 0 && <p className="mobile-subtitle">{photoFiles.length} photo(s) selected</p>}
            <button className="mobile-button" type="button" onClick={create}>Submit observation</button>
          </div>
        </MobileSheet>
      )}
      {showObservationLocationPicker && (
        <MobileSheet title="Select observation location" onClose={() => setShowObservationLocationPicker(false)}>
          <div className="mobile-tree-list">
            {observationLocationRoots.map((node) => (
              <MobileLocationPickerTree
                key={node.id}
                node={node}
                childrenMap={observationChildrenMap}
                selectedId={form.epsNodeId}
                onSelect={(location) => {
                  setForm((current) => ({ ...current, epsNodeId: String(location.id) }));
                  setShowObservationLocationPicker(false);
                }}
              />
            ))}
          </div>
        </MobileSheet>
      )}
      {selected && (
        <MobileSheet
          title={mode ? `${mode === "rectify" ? "Rectify" : mode === "close" ? "Close" : "Reject rectification"}` : "Observation detail"}
          onClose={() => { setSelected(null); setMode(null); setActionText(""); setActionFiles([]); }}
        >
          <div className="mobile-stack">
            <div className="mobile-card mobile-card-pad">
              <span className={statusChipClass(selected.status || selected.severity || selected.observationRating)}>{selected.observationRating || selected.severity || selected.status || "Observation"}</span>
              <h3 className="mobile-title" style={{ marginTop: 8 }}>{selected.description || selected.observationText || "Observation"}</h3>
              {selected.remarks && <p className="mobile-subtitle">Remarks: {selected.remarks}</p>}
              <p className="mobile-subtitle">{actorLine("Raised by", selected.raisedBy || selected.createdByUser || selected.raisedById, selected.createdAt)}</p>
              <p className="mobile-subtitle">{actorLine("Rectifier", selected.rectifiedBy || selected.rectifiedById, selected.rectifiedAt)}</p>
              <p className="mobile-subtitle">{actorLine("Closer", selected.closedByUser || selected.closedBy || selected.closedById, selected.closedAt)}</p>
              {selected.rectificationText && <p className="mobile-subtitle">Rectification: {selected.rectificationText}</p>}
              {selected.rectificationRejectedRemarks && <p className="mobile-subtitle">Rejected reason: {selected.rectificationRejectedRemarks}</p>}
            </div>
            {evidencePhotos(selected).length > 0 && (
              <div className="mobile-attachment-grid">
                {evidencePhotos(selected).map((photo, index) => (
                  <a key={`${selected.id}-photo-${index}`} className="mobile-attachment-tile" href={getPublicFileUrl(photo)} target="_blank" rel="noreferrer">
                    <img src={getPublicFileUrl(photo)} alt="Observation evidence" />
                    <span>Evidence {index + 1}</span>
                  </a>
                ))}
              </div>
            )}
            {(selected.rectificationHistory || []).length > 0 && (
              <div className="mobile-card mobile-card-pad">
                <h3 className="mobile-title">Rectification history</h3>
                {(selected.rectificationHistory || []).map((entry: AnyRecord, index: number) => (
                  <div className="mobile-history-row" key={`${selected.id}-history-${index}`}>
                    <span className={statusChipClass(entry.type)}>{entry.type}</span>
                    <p>{entry.text || entry.rejectionRemarks || "No remarks"}</p>
                    <small>{entry.at ? new Date(entry.at).toLocaleString() : ""}</small>
                  </div>
                ))}
              </div>
            )}
            {mode ? (
              <>
                <textarea className="mobile-textarea" placeholder={mode === "reject" ? "Rejection reason" : "Remarks"} value={actionText} onChange={(event) => setActionText(event.target.value)} />
                {mode === "rectify" && (
                  <>
                    <label className="mobile-button secondary">
                      <Camera size={18} /> Add rectification photos
                      <input hidden type="file" accept="image/*" capture="environment" multiple onChange={(event) => setActionFiles(Array.from(event.target.files || []))} />
                    </label>
                    {actionFiles.length > 0 && <p className="mobile-subtitle">{actionFiles.length} photo(s) selected</p>}
                  </>
                )}
                <button className={mode === "reject" ? "mobile-button danger" : "mobile-button"} type="button" onClick={submitAction}>Save action</button>
                <button className="mobile-button secondary" type="button" onClick={() => { setMode(null); setActionText(""); setActionFiles([]); }}>Back to detail</button>
              </>
            ) : (
              <div className="mobile-action-row">
                {canRectifyObservation && (
                  <button className="mobile-button secondary" type="button" onClick={() => setMode("rectify")}>Rectify</button>
                )}
                {canCloseObservation && (
                  <button className="mobile-button secondary" type="button" onClick={() => setMode("close")}>Close</button>
                )}
                {canRejectObservationRectification && (
                  <button className="mobile-button danger" type="button" onClick={() => setMode("reject")}>Reject rectification</button>
                )}
              </div>
            )}
          </div>
        </MobileSheet>
      )}
    </MobileShell>
  );
}

function CubeRegisterPage() {
  const { projectId } = useParams();
  const { hasPermission } = useAuth();
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [draft, setDraft] = useState<AnyRecord>({});
  const [evidence, setEvidence] = useState<AnyRecord[]>([]);
  const [message, setMessage] = useState("");
  const canSaveCube = hasAnyPermission(hasPermission, [
    PermissionCode.QUALITY_CUBE_TEST_SAVE,
    PermissionCode.QUALITY_CUBE_TEST_UPDATE,
  ]);
  const canApproveCube = hasPermission(PermissionCode.QUALITY_CUBE_TEST_APPROVE);
  const canDeleteCube = hasPermission(PermissionCode.QUALITY_CUBE_TEST_DELETE);
  const canUploadCubeEvidence = hasPermission(PermissionCode.QUALITY_MATERIAL_EVIDENCE_UPLOAD);
  useEffect(() => {
    if (!projectId) return;
    qualityService.getCubeTestRegister(Number(projectId)).then(setItems).catch(() => setItems([]));
  }, [projectId]);

  const openCube = async (cube: AnyRecord) => {
    setSelected(cube);
    setDraft({
      loadKn: cube.loadKn || "",
      requiredStrengthMpa: cube.requiredStrengthMpa || "",
      testedDate: cube.testedDate || new Date().toISOString().slice(0, 10),
      remarks: cube.remarks || "",
      specimenSize: cube.specimenSize || "150 x 150 x 150 mm",
    });
    setEvidence([]);
    if (projectId) {
      qualityService
        .getMaterialEvidence(Number(projectId), "CUBE_TEST_REGISTER", Number(cube.id))
        .then(setEvidence)
        .catch(() => setEvidence([]));
    }
  };

  const saveCube = async (approve = false) => {
    if (!selected) return;
    try {
      const payload = {
        ...draft,
        loadKn: draft.loadKn || undefined,
        requiredStrengthMpa: draft.requiredStrengthMpa || undefined,
      };
      const updated = approve
        ? await qualityService.approveCubeTestRegister(Number(selected.id), payload)
        : await qualityService.updateCubeTestRegister(Number(selected.id), payload);
      setSelected(updated);
      setItems((current) => current.map((item) => (Number(item.id) === Number(updated.id) ? updated : item)));
      setMessage(approve ? "Cube result approved." : "Cube result saved.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Cube action failed.");
    }
  };

  const deleteCube = async () => {
    if (!selected || !window.confirm("Delete this cube test register row?")) return;
    try {
      await qualityService.deleteCubeTestRegister(Number(selected.id));
      setItems((current) => current.filter((item) => Number(item.id) !== Number(selected.id)));
      setSelected(null);
      setMessage("Cube row deleted.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Delete failed.");
    }
  };

  const uploadEvidence = async (file?: File | null) => {
    if (!file || !selected || !projectId) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("ownerType", "CUBE_TEST_REGISTER");
      formData.append("ownerId", String(selected.id));
      formData.append("evidenceType", file.type.startsWith("image/") ? "PHOTO" : "LAB_REPORT");
      formData.append("description", `Cube evidence for ${selected.cubeId || selected.id}`);
      const uploaded = await qualityService.uploadMaterialEvidence(Number(projectId), formData);
      setEvidence((current) => [uploaded, ...current]);
      setMessage("Evidence uploaded.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Evidence upload failed.");
    }
  };

  const visible = items
    .filter((item) => filter === "ALL" || String(item.status || "").toUpperCase() === filter)
    .filter((item) => JSON.stringify(item).toLowerCase().includes(search.toLowerCase()));

  return (
    <MobileShell title="Cube Register" subtitle="Concrete cube tests">
      <div className="mobile-stack">
        <div className="mobile-search-card">
          <Search size={17} />
          <input placeholder="Search cube, RFI, GO, location, grade" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="mobile-pill-tabs">
          {["ALL", "PENDING", "DUE_TODAY", "OVERDUE", "FAILED", "APPROVED"].map((key) => (
            <button key={key} className={filter === key ? "active" : ""} type="button" onClick={() => setFilter(key)}>
              {key.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        {message && <div className={message.includes("failed") ? "mobile-chip danger" : "mobile-chip"}>{message}</div>}
        {visible.map((item) => (
          <button className="mobile-card mobile-card-pad mobile-observation-card" key={item.id} type="button" onClick={() => openCube(item)}>
            <div className="mobile-row">
              <div>
                <span className={statusChipClass(item.status)}>{item.status || "Pending"}</span>
                <h3 className="mobile-title" style={{ marginTop: 8 }}>{item.cubeId}</h3>
                <p className="mobile-subtitle">{item.mixIdOrGrade} / {item.testAge?.replace("_", " ") || "Age"} / Due {dateText(item.dueDate)}</p>
                <p className="mobile-subtitle">{item.locationText || "-"} / {item.goLabel || "GO"} / RFI #{item.inspectionId || "-"}</p>
                <p className="mobile-subtitle">Load {item.loadKn || "-"} kN / MPa {item.compressiveStrengthMpa || item.mpa || "Auto"}</p>
              </div>
              <ChevronRight size={18} />
            </div>
          </button>
        ))}
        {visible.length === 0 && <div className="mobile-card mobile-empty">No cube tests found.</div>}
        {selected && (
          <MobileSheet title={selected.cubeId || "Cube result"} onClose={() => setSelected(null)}>
            <div className="mobile-stack">
              <div className="mobile-card mobile-card-pad">
                <span className={statusChipClass(selected.status)}>{selected.status || "Pending"}</span>
                <h3 className="mobile-title" style={{ marginTop: 8 }}>{selected.mixIdOrGrade || "Concrete grade"}</h3>
                <p className="mobile-subtitle">{selected.locationText || "-"} / {selected.elementName || "-"} / {selected.goLabel || "GO"}</p>
                <p className="mobile-subtitle">Due {dateText(selected.dueDate)} / Cast {dateText(selected.castDate)}</p>
                <p className="mobile-subtitle">Strength: {selected.compressiveStrengthMpa || selected.mpa || "Auto"} MPa / Required {selected.requiredStrengthMpa || "-"}</p>
              </div>
              <input className="mobile-input" inputMode="decimal" placeholder="Load kN" value={draft.loadKn || ""} onChange={(event) => setDraft({ ...draft, loadKn: event.target.value })} />
              <input className="mobile-input" inputMode="decimal" placeholder="Required MPa" value={draft.requiredStrengthMpa || ""} onChange={(event) => setDraft({ ...draft, requiredStrengthMpa: event.target.value })} />
              <input className="mobile-input" type="date" value={draft.testedDate || ""} onChange={(event) => setDraft({ ...draft, testedDate: event.target.value })} />
              <textarea className="mobile-textarea" placeholder="Remarks" value={draft.remarks || ""} onChange={(event) => setDraft({ ...draft, remarks: event.target.value })} />
              <div className="mobile-action-row">
                {canSaveCube && (
                  <button className="mobile-button secondary" type="button" onClick={() => saveCube(false)}>Save result</button>
                )}
                {canApproveCube && (
                  <button className="mobile-button" type="button" disabled={String(selected.status || "").toUpperCase() === "APPROVED"} onClick={() => saveCube(true)}>
                    {String(selected.status || "").toUpperCase() === "APPROVED" ? "Approved" : "Approve"}
                  </button>
                )}
                {canDeleteCube && (
                  <button className="mobile-button danger" type="button" onClick={deleteCube}>Delete</button>
                )}
              </div>
              {canUploadCubeEvidence && (
                <label className="mobile-button secondary">
                  <Camera size={18} /> Upload evidence
                  <input hidden type="file" accept="image/*,.pdf" capture="environment" onChange={(event) => uploadEvidence(event.target.files?.[0])} />
                </label>
              )}
              {evidence.length > 0 && (
                <div className="mobile-attachment-grid">
                  {evidence.map((file) => (
                    <a key={file.id} className="mobile-attachment-tile" href={getPublicFileUrl(file.relativeUrl || file.url)} target="_blank" rel="noreferrer">
                      {String(file.mimeType || "").startsWith("image/") ? (
                        <img src={getPublicFileUrl(file.relativeUrl || file.url)} alt={file.originalName || "Evidence"} />
                      ) : (
                        <Paperclip size={22} />
                      )}
                      <span>{file.originalName || file.fileName || "Evidence"}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </MobileSheet>
        )}
      </div>
    </MobileShell>
  );

  return (
    <MobileShell title="Cube Register" subtitle="Concrete cube tests">
      <div className="mobile-stack">
        {items.map((item) => (
          <div className="mobile-card mobile-card-pad" key={item.id}>
            <span className={statusChipClass(item.status)}>{item.status || "Pending"}</span>
            <h3 className="mobile-title" style={{ marginTop: 8 }}>{item.cubeId}</h3>
            <p className="mobile-subtitle">{item.mixIdOrGrade} · Due {dateText(item.dueDate)}</p>
            <p className="mobile-subtitle">MPa: {item.compressiveStrengthMpa || item.mpa || "Auto"}</p>
          </div>
        ))}
        {items.length === 0 && <div className="mobile-card mobile-empty">No cube tests found.</div>}
      </div>
    </MobileShell>
  );
}

function EhsHomePage() {
  const { projectId } = useParams();
  const [summary, setSummary] = useState<AnyRecord | null>(null);
  useEffect(() => {
    if (!projectId) return;
    api.get(`/ehs/${projectId}/summary`).then((res) => setSummary(res.data)).catch(() => setSummary(null));
  }, [projectId]);
  return (
    <MobileShell title="EHS" subtitle="Site safety management">
      <div className="mobile-stack">
        <div className="mobile-grid-2">
          <div className="mobile-kpi"><strong>{summary?.observations?.open || 0}</strong><span>Open Obs</span></div>
          <div className="mobile-kpi"><strong>{summary?.incidents?.total || 0}</strong><span>Incidents</span></div>
          <div className="mobile-kpi"><strong>{summary?.legal?.expired || 0}</strong><span>Expired</span></div>
          <div className="mobile-kpi"><strong>{summary?.manhours?.total || 0}</strong><span>Manhours</span></div>
        </div>
        <Link className="mobile-button secondary" to="observations"><AlertTriangle size={18} /> EHS Observations</Link>
        <Link className="mobile-button secondary" to="incidents"><Bell size={18} /> EHS Incidents</Link>
      </div>
    </MobileShell>
  );
}

function EhsListPage({ incidents = false }: { incidents?: boolean }) {
  const { projectId } = useParams();
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!projectId) return;
    const request = incidents
      ? api.get(`/ehs/${projectId}/incidents-register`)
      : api.get("/ehs/site-observations", { params: { projectId } });
    request
      .then((res) => setItems(res.data?.items || res.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [projectId, incidents]);
  return (
    <MobileShell title={incidents ? "EHS Incidents" : "EHS Observations"} subtitle={incidents ? "Incident register" : "Safety observations"}>
      <div className="mobile-stack">
        {loading && <LoadingCard />}
        {items.map((item) => (
          <div className="mobile-card mobile-card-pad" key={item.id}>
            <span className={statusChipClass(item.status || item.severity || item.incidentType)}>{item.status || item.severity || item.incidentType || "Record"}</span>
            <h3 className="mobile-title" style={{ marginTop: 8 }}>{item.title || item.description || item.observation || item.incidentDescription || "EHS record"}</h3>
            <p className="mobile-subtitle">{dateText(item.createdAt || item.incidentDate)} · Raised by {pickName(item.raisedBy || item.createdByUser)}</p>
          </div>
        ))}
        {!loading && items.length === 0 && <div className="mobile-card mobile-empty">No records found.</div>}
      </div>
    </MobileShell>
  );
}

function EhsListPageFull({ incidents = false }: { incidents?: boolean }) {
  const { projectId } = useParams();
  const { hasPermission } = useAuth();
  const { project, locations } = useProjectLocations(projectId);
  const [items, setItems] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [selected, setSelected] = useState<AnyRecord | null>(null);
  const [mode, setMode] = useState<"rectify" | "close" | "reject" | null>(null);
  const [actionText, setActionText] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [actionFiles, setActionFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    epsNodeId: "",
    category: "Safety",
    severity: "MINOR",
    description: "",
    targetDate: "",
    incidentType: "First Aid",
    date: new Date().toISOString().slice(0, 10),
  });
  const ehsChildrenMap = useMemo(() => buildChildrenMap(locations), [locations]);
  const ehsLocationIds = useMemo(() => new Set(locations.map((node) => node.id)), [locations]);
  const ehsLocationRoots = useMemo(
    () => locations.filter((node) => !node.parentId || !ehsLocationIds.has(node.parentId)),
    [ehsLocationIds, locations],
  );
  const selectedLocation = locations.find((location) => location.id === Number(form.epsNodeId));
  const selectedLocationPath = formatLocationPath(form.epsNodeId, locations, project);
  const canCreateEhsRecord = incidents
    ? hasPermission(PermissionCode.EHS_INCIDENT_CREATE)
    : hasPermission(PermissionCode.EHS_SITE_OBS_CREATE);
  const canRectifyEhsObservation = hasPermission(PermissionCode.EHS_SITE_OBS_RECTIFY);
  const canCloseEhsObservation = hasPermission(PermissionCode.EHS_SITE_OBS_CLOSE);
  const canRejectEhsRectification = hasPermission(PermissionCode.EHS_SITE_OBS_REJECT_RECTIFICATION);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const request = incidents
      ? api.get(`/ehs/${projectId}/incidents-register`)
      : api.get("/ehs/site-observations", { params: { projectId } });
    try {
      const res = await request;
      setItems(res.data?.items || res.data || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId, incidents]);

  const create = async () => {
    try {
      if (incidents) {
        await api.post(`/ehs/${projectId}/incidents-register`, {
          projectId: Number(projectId),
          category: form.category,
          incidentType: form.incidentType,
          description: form.description,
          date: form.date,
        });
      } else {
        const photos = photoFiles.length ? await uploadMobileFiles(photoFiles) : [];
        await api.post("/ehs/site-observations", {
          projectId: Number(projectId),
          epsNodeId: form.epsNodeId ? Number(form.epsNodeId) : null,
          locationLabel: selectedLocationPath,
          category: form.category,
          severity: form.severity,
          description: form.description,
          targetDate: form.targetDate,
          photos,
        });
      }
      setShowCreate(false);
      setPhotoFiles([]);
      setMessage("Record created.");
      await load();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Unable to create record.");
    }
  };

  const submitAction = async () => {
    if (!selected || !mode || incidents) return;
    if (mode === "reject" && !actionText.trim()) {
      setMessage("Reject reason is mandatory.");
      return;
    }
    try {
      if (mode === "rectify") {
        const rectificationPhotos = actionFiles.length ? await uploadMobileFiles(actionFiles) : [];
        await api.patch(`/ehs/site-observations/${selected.id}/rectify`, {
          rectificationText: actionText,
          rectificationPhotos,
        });
      } else if (mode === "close") {
        await api.patch(`/ehs/site-observations/${selected.id}/close`, {
          closureRemarks: actionText,
        });
      } else {
        await api.patch(`/ehs/site-observations/${selected.id}/reject-rectification`, {
          rejectionRemarks: actionText,
        });
      }
      setSelected(null);
      setMode(null);
      setActionText("");
      setActionFiles([]);
      setMessage("Action saved.");
      await load();
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Action failed.");
    }
  };

  return (
    <MobileShell title={incidents ? "EHS Incidents" : "EHS Observations"} subtitle={incidents ? "Incident register" : "Raise, rectify, close"}>
      <div className="mobile-stack">
        {canCreateEhsRecord && (
          <button className="mobile-button" type="button" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> {incidents ? "Report incident" : "Raise observation"}
          </button>
        )}
        {message && <div className={message.includes("failed") || message.includes("mandatory") ? "mobile-chip danger" : "mobile-chip"}>{message}</div>}
        {loading && <LoadingCard />}
        {items.map((item) => (
          <button
            className="mobile-card mobile-card-pad mobile-observation-card"
            key={item.id}
            type="button"
            onClick={() => {
              setSelected(item);
              setMode(null);
              setActionText("");
              setActionFiles([]);
            }}
          >
            <div className="mobile-row">
              <div>
                <span className={statusChipClass(item.status || item.severity || item.incidentType)}>{item.status || item.severity || item.incidentType || "Record"}</span>
                <h3 className="mobile-title" style={{ marginTop: 8 }}>{item.description || item.observation || item.incidentDescription || "EHS record"}</h3>
                <p className="mobile-subtitle">{actorLine("Raised by", item.raisedBy || item.createdByUser || item.raisedById, item.createdAt || item.date || item.incidentDate)}</p>
                <p className="mobile-subtitle">{item.locationLabel || "Location not set"}</p>
              </div>
              <ChevronRight size={18} />
            </div>
            {evidencePhotos(item).length > 0 && (
              <div className="mobile-photo-strip">
                {evidencePhotos(item).slice(0, 3).map((photo, index) => (
                  <img key={`${item.id}-${index}`} src={getPublicFileUrl(photo)} alt="EHS evidence" />
                ))}
              </div>
            )}
          </button>
        ))}
        {!loading && items.length === 0 && <div className="mobile-card mobile-empty">No records found.</div>}
      </div>
      {showCreate && (
        <MobileSheet title={incidents ? "Report incident" : "Raise EHS observation"} onClose={() => setShowCreate(false)}>
          <div className="mobile-stack">
            {!incidents && (
              <button className="mobile-button secondary" type="button" onClick={() => setShowLocationPicker(true)}>
                {selectedLocation ? `${selectedLocationPath || selectedLocation.name} (${selectedLocation.type})` : "Select location from tree"}
              </button>
            )}
            <input className="mobile-input" placeholder="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
            {incidents ? (
              <select className="mobile-select" value={form.incidentType} onChange={(event) => setForm({ ...form, incidentType: event.target.value })}>
                <option>First Aid</option>
                <option>Near Miss</option>
                <option>Dangerous Occurrence</option>
                <option>Minor</option>
                <option>Major</option>
                <option>Fatal</option>
              </select>
            ) : (
              <select className="mobile-select" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>
                <option value="INFO">Info</option>
                <option value="MINOR">Minor</option>
                <option value="MAJOR">Major</option>
                <option value="CRITICAL">Critical</option>
              </select>
            )}
            <textarea className="mobile-textarea" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <input className="mobile-input" type="date" value={incidents ? form.date : form.targetDate} onChange={(event) => setForm(incidents ? { ...form, date: event.target.value } : { ...form, targetDate: event.target.value })} />
            {!incidents && (
              <>
                <label className="mobile-button secondary">
                  <Camera size={18} /> Add observation photos
                  <input hidden type="file" accept="image/*" capture="environment" multiple onChange={(event) => setPhotoFiles(Array.from(event.target.files || []))} />
                </label>
                {photoFiles.length > 0 && <p className="mobile-subtitle">{photoFiles.length} photo(s) selected</p>}
              </>
            )}
            <button className="mobile-button" type="button" onClick={create}>Submit</button>
          </div>
        </MobileSheet>
      )}
      {showLocationPicker && (
        <MobileSheet title="Select EHS location" onClose={() => setShowLocationPicker(false)}>
          <div className="mobile-tree-list">
            {ehsLocationRoots.map((node) => (
              <MobileLocationPickerTree
                key={node.id}
                node={node}
                childrenMap={ehsChildrenMap}
                selectedId={form.epsNodeId}
                onSelect={(location) => {
                  setForm((current) => ({ ...current, epsNodeId: String(location.id) }));
                  setShowLocationPicker(false);
                }}
              />
            ))}
          </div>
        </MobileSheet>
      )}
      {selected && (
        <MobileSheet
          title={mode ? `${mode === "rectify" ? "Rectify" : mode === "close" ? "Close" : "Reject rectification"}` : incidents ? "Incident detail" : "EHS observation detail"}
          onClose={() => { setSelected(null); setMode(null); setActionText(""); setActionFiles([]); }}
        >
          <div className="mobile-stack">
            <div className="mobile-card mobile-card-pad">
              <span className={statusChipClass(selected.status || selected.severity || selected.incidentType)}>{selected.status || selected.severity || selected.incidentType || "Record"}</span>
              <h3 className="mobile-title" style={{ marginTop: 8 }}>{selected.description || selected.observation || selected.incidentDescription || "EHS record"}</h3>
              <p className="mobile-subtitle">{actorLine("Raised by", selected.raisedBy || selected.createdByUser || selected.raisedById, selected.createdAt || selected.date || selected.incidentDate)}</p>
              <p className="mobile-subtitle">{actorLine("Rectifier", selected.rectifiedBy || selected.rectifiedById, selected.rectifiedAt)}</p>
              <p className="mobile-subtitle">{actorLine("Closer", selected.closedByUser || selected.closedBy || selected.closedById, selected.closedAt)}</p>
              {selected.rectificationText && <p className="mobile-subtitle">Rectification: {selected.rectificationText}</p>}
              {selected.rectificationRejectedRemarks && <p className="mobile-subtitle">Rejected reason: {selected.rectificationRejectedRemarks}</p>}
            </div>
            {evidencePhotos(selected).length > 0 && (
              <div className="mobile-attachment-grid">
                {evidencePhotos(selected).map((photo, index) => (
                  <a key={`${selected.id}-photo-${index}`} className="mobile-attachment-tile" href={getPublicFileUrl(photo)} target="_blank" rel="noreferrer">
                    <img src={getPublicFileUrl(photo)} alt="EHS evidence" />
                    <span>Evidence {index + 1}</span>
                  </a>
                ))}
              </div>
            )}
            {!incidents && mode ? (
              <>
                <textarea className="mobile-textarea" placeholder={mode === "reject" ? "Rejection reason" : "Remarks"} value={actionText} onChange={(event) => setActionText(event.target.value)} />
                {mode === "rectify" && (
                  <>
                    <label className="mobile-button secondary">
                      <Camera size={18} /> Add rectification photos
                      <input hidden type="file" accept="image/*" capture="environment" multiple onChange={(event) => setActionFiles(Array.from(event.target.files || []))} />
                    </label>
                    {actionFiles.length > 0 && <p className="mobile-subtitle">{actionFiles.length} photo(s) selected</p>}
                  </>
                )}
                <button className={mode === "reject" ? "mobile-button danger" : "mobile-button"} type="button" onClick={submitAction}>Save action</button>
                <button className="mobile-button secondary" type="button" onClick={() => { setMode(null); setActionText(""); setActionFiles([]); }}>Back to detail</button>
              </>
            ) : !incidents ? (
              <div className="mobile-action-row">
                {canRectifyEhsObservation && (
                  <button className="mobile-button secondary" type="button" onClick={() => setMode("rectify")}>Rectify</button>
                )}
                {canCloseEhsObservation && (
                  <button className="mobile-button secondary" type="button" onClick={() => setMode("close")}>Close</button>
                )}
                {canRejectEhsRectification && (
                  <button className="mobile-button danger" type="button" onClick={() => setMode("reject")}>Reject rectification</button>
                )}
              </div>
            ) : null}
          </div>
        </MobileSheet>
      )}
    </MobileShell>
  );
}

function ProfilePage() {
  const { user } = useAuth();
  const [signature, setSignature] = useState<string | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    api.get("/users/me/signature").then((res) => setSignature(res.data?.signatureData || null)).catch(() => setSignature(null));
  }, []);

  const cleanSignatureImage = (file: File) => {
    setMessage("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = 0;
        let maxY = 0;
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            const idx = (y * canvas.width + x) * 4;
            const lum = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            if (lum > 186) {
              data[idx + 3] = 0;
            } else {
              data[idx] = 18;
              data[idx + 1] = 24;
              data[idx + 2] = 22;
              data[idx + 3] = Math.min(255, Math.max(90, 255 - lum));
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
        const pad = 16;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(canvas.width - cropX, maxX - minX + pad * 2 || canvas.width);
        const cropH = Math.min(canvas.height - cropY, maxY - minY + pad * 2 || canvas.height);
        const out = document.createElement("canvas");
        out.width = cropW;
        out.height = cropH;
        out.getContext("2d")?.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        setPreviewSignature(out.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const saveSignature = async () => {
    if (!previewSignature) return;
    try {
      await api.put("/users/me/signature", { signatureData: previewSignature });
      setSignature(previewSignature);
      setPreviewSignature(null);
      setMessage("Signature saved.");
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Unable to save signature.");
    }
  };

  return (
    <MobileShell title="Profile" subtitle="Account and signature">
      <div className="mobile-stack">
        <div className="mobile-card mobile-card-pad">
          <h2 className="mobile-title">{user?.displayName || user?.username}</h2>
          <p className="mobile-subtitle">{user?.designation || "Designation not set"}</p>
          <p className="mobile-subtitle">Roles: {user?.roles?.join(", ")}</p>
        </div>
        <div className="mobile-card mobile-card-pad">
          <h3 className="mobile-title">Signature</h3>
          {signature ? <img src={signature} alt="Signature" style={{ width: "100%", maxHeight: 150, objectFit: "contain", background: "#fff", borderRadius: 12 }} /> : <p className="mobile-subtitle">No signature uploaded.</p>}
          <label className="mobile-button secondary" style={{ marginTop: 12 }}>
            Upload paper signature
            <input hidden type="file" accept="image/*" onChange={(event) => event.target.files?.[0] && cleanSignatureImage(event.target.files[0])} />
          </label>
          {previewSignature && (
            <div className="mobile-card mobile-card-pad" style={{ marginTop: 12 }}>
              <p className="mobile-subtitle">Preview cleaned signature</p>
              <img src={previewSignature} alt="Cleaned signature preview" style={{ width: "100%", maxHeight: 150, objectFit: "contain", background: "#fff", borderRadius: 12 }} />
              <div className="mobile-grid-2" style={{ marginTop: 10 }}>
                <button className="mobile-button" type="button" onClick={saveSignature}>Confirm save</button>
                <button className="mobile-button secondary" type="button" onClick={() => setPreviewSignature(null)}>Discard</button>
              </div>
            </div>
          )}
          {message && <div className={message.includes("Unable") ? "mobile-chip danger" : "mobile-chip"}>{message}</div>}
        </div>
      </div>
    </MobileShell>
  );
}

void InspectionCard;
void InspectionDetailPage;
void EhsListPage;

function SignatureConfirmPage() {
  return (
    <MobileShell title="Signature QR" subtitle="Confirm scanned signature">
      <div className="mobile-card mobile-card-pad">
        <CheckCircle2 color="#2e7d43" />
        <h2 className="mobile-title" style={{ marginTop: 8 }}>QR confirmation entry</h2>
        <p className="mobile-subtitle">This route is ready for QR token handling. The confirmation action will use the existing backend signature session APIs.</p>
      </div>
    </MobileShell>
  );
}

function MobileSettingsPage() {
  const [theme, setTheme] = useStoredMobileSetting<MobileTheme>("setu-mobile-theme", "light");
  const [siteMode, setSiteMode] = useStoredMobileSetting<MobileSiteMode>("setu-mobile-site-mode", "normal");
  const [message, setMessage] = useState("");
  const notificationStatus =
    typeof Notification === "undefined" ? "Not supported" : Notification.permission;

  const clearLocal = () => {
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith("setu-mobile-") || key.startsWith("mobile-rfi-draft-"))
      .forEach((key) => window.localStorage.removeItem(key));
    window.dispatchEvent(new Event(MOBILE_SETTINGS_EVENT));
    setMessage("Mobile web local cache cleared.");
  };

  return (
    <MobileShell title="Mobile Settings" subtitle="Field display and local controls">
      <div className="mobile-stack">
        <section className="mobile-card mobile-card-pad">
          <h3 className="mobile-title">Display Mode</h3>
          <p className="mobile-subtitle">These settings only affect the separate mobile web UI.</p>
          <div className="mobile-segmented" style={{ marginTop: 12 }}>
            {(["light", "dark", "contrast"] as MobileTheme[]).map((option) => (
              <button key={option} className={theme === option ? "active" : ""} type="button" onClick={() => setTheme(option)}>
                {option === "light" ? "Light" : option === "dark" ? "Dark" : "High Contrast"}
              </button>
            ))}
          </div>
        </section>

        <section className="mobile-card mobile-card-pad">
          <h3 className="mobile-title">Site Mode</h3>
          <p className="mobile-subtitle">Large mode increases touch targets and spacing for site use.</p>
          <div className="mobile-segmented" style={{ marginTop: 12 }}>
            {(["normal", "large"] as MobileSiteMode[]).map((option) => (
              <button key={option} className={siteMode === option ? "active" : ""} type="button" onClick={() => setSiteMode(option)}>
                {option === "normal" ? "Normal" : "Large"}
              </button>
            ))}
          </div>
        </section>

        <section className="mobile-card mobile-card-pad">
          <h3 className="mobile-title">Phone Features</h3>
          <div className="mobile-settings-row">
            <div>
              <strong>Notifications</strong>
              <small>{notificationStatus}</small>
            </div>
            <button
              className="mobile-button secondary compact"
              type="button"
              disabled={typeof Notification === "undefined" || Notification.permission !== "default"}
              onClick={async () => {
                if (typeof Notification !== "undefined") {
                  const result = await Notification.requestPermission();
                  setMessage(`Notification permission: ${result}`);
                }
              }}
            >
              Enable
            </button>
          </div>
          <div className="mobile-settings-row">
            <div>
              <strong>Install App</strong>
              <small>Use browser menu if install prompt is not visible.</small>
            </div>
            <Smartphone size={20} />
          </div>
        </section>

        <section className="mobile-card mobile-card-pad">
          <h3 className="mobile-title">Local Data</h3>
          <p className="mobile-subtitle">Clears drafts, favorite locations, recent RFIs and display preferences stored on this browser.</p>
          <button className="mobile-button danger" type="button" onClick={clearLocal}>Clear mobile local cache</button>
          {message && <p className="mobile-subtitle" style={{ marginTop: 10 }}>{message}</p>}
        </section>
      </div>
    </MobileShell>
  );
}

export default function MobileApp() {
  return (
    <Routes>
      <Route index element={<Navigate to="projects" replace />} />
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="projects/:projectId" element={<ProjectModulesPage />} />
      <Route path="projects/:projectId/tasks" element={<MyTasksPage />} />
      <Route path="projects/:projectId/qr" element={<QrEntryPage />} />
      <Route path="projects/:projectId/search" element={<MobileGlobalSearchPage />} />
      <Route path="projects/:projectId/quality" element={<QualityHomePage />} />
      <Route path="projects/:projectId/quality/locations" element={<QualityHomePage />} />
      <Route path="projects/:projectId/quality/locations/:epsNodeId" element={<QualityLocationPage />} />
      <Route path="projects/:projectId/quality/requests" element={<RfiListPage />} />
      <Route path="projects/:projectId/quality/requests/new" element={<RaiseRfiPage />} />
      <Route path="projects/:projectId/quality/approvals" element={<RfiListPage approvals />} />
      <Route path="projects/:projectId/quality/inspections/:inspectionId" element={<InspectionDetailPageFull />} />
      <Route path="projects/:projectId/quality/inspections/:inspectionId/pour-card" element={<MobileConcreteDocumentPage type="pour" />} />
      <Route path="projects/:projectId/quality/inspections/:inspectionId/pre-pour-clearance" element={<MobileConcreteDocumentPage type="clearance" />} />
      <Route path="projects/:projectId/quality/observations" element={<QualityObservationsPageFull />} />
      <Route path="projects/:projectId/quality/ncr" element={<QualityObservationsPage ncrOnly />} />
      <Route path="projects/:projectId/quality/materials/cubes" element={<CubeRegisterPage />} />
      <Route path="projects/:projectId/ehs" element={<EhsHomePage />} />
      <Route path="projects/:projectId/ehs/observations" element={<EhsListPageFull />} />
      <Route path="projects/:projectId/ehs/incidents" element={<EhsListPageFull incidents />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="settings" element={<MobileSettingsPage />} />
      <Route path="signature/confirm" element={<SignatureConfirmPage />} />
      <Route path="*" element={<Navigate to="/m/projects" replace />} />
    </Routes>
  );
}

export { MobileLogin };
