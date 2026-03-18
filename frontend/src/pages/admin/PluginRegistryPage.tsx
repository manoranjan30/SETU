import { useEffect, useState } from "react";
import { pluginService } from "../../services/plugin.service";
import { usePluginRuntime } from "../../context/PluginRuntimeContext";

const PluginRegistryPage = () => {
  const { refresh } = usePluginRuntime();
  const [plugins, setPlugins] = useState<any[]>([]);
  const [bundleText, setBundleText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pluginService.listInstalls();
      setPlugins(data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load plugins.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onInstall = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (selectedFile) {
        await pluginService.uploadBundle(selectedFile);
      } else {
        const bundle = JSON.parse(bundleText);
        await pluginService.installBundle(bundle, "ADMIN_PORTAL");
      }
      setMessage("Plugin installed successfully.");
      setBundleText("");
      setSelectedFile(null);
      await Promise.all([load(), refresh()]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Install failed.");
    } finally {
      setLoading(false);
    }
  };

  const onAction = async (
    id: number,
    action: "enable" | "disable" | "uninstall",
  ) => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (action === "enable") await pluginService.enable(id);
      if (action === "disable") await pluginService.disable(id);
      if (action === "uninstall") await pluginService.uninstall(id);
      setMessage(`Plugin ${action}d successfully.`);
      await Promise.all([load(), refresh()]);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? `${action} failed.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Plugin Registry
          </h1>
          <p className="text-sm text-text-muted">
            Install approved plugin bundles, manage lifecycle, and expose runtime
            extensions safely.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="ui-card p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Installed Plugins
            </h2>
            <p className="text-sm text-text-muted">
              Disable before uninstalling. Runtime menus and pages update after a
              successful lifecycle action.
            </p>
          </div>
          <div className="space-y-3">
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className="rounded-xl border border-border-default bg-surface-base p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-text-primary">
                      {plugin.pluginPackage?.name ?? plugin.pluginKey}
                    </div>
                    <div className="text-xs text-text-muted">
                      {plugin.pluginKey} · v{plugin.version}
                    </div>
                    <div className="mt-2 text-xs text-text-muted">
                      Status:{" "}
                      <span className="font-semibold text-text-primary">
                        {plugin.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {plugin.status !== "ENABLED" && plugin.status !== "UNINSTALLED" && (
                      <button
                        onClick={() => void onAction(plugin.id, "enable")}
                        className="rounded-lg border border-border-default px-3 py-1.5 text-sm"
                      >
                        Enable
                      </button>
                    )}
                    {plugin.status === "ENABLED" && (
                      <button
                        onClick={() => void onAction(plugin.id, "disable")}
                        className="rounded-lg border border-border-default px-3 py-1.5 text-sm"
                      >
                        Disable
                      </button>
                    )}
                    {plugin.status !== "UNINSTALLED" && (
                      <button
                        onClick={() => void onAction(plugin.id, "uninstall")}
                        className="rounded-lg border border-error/30 px-3 py-1.5 text-sm text-error"
                      >
                        Uninstall
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!plugins.length && !loading && (
              <div className="rounded-xl border border-dashed border-border-default p-6 text-sm text-text-muted">
                No plugins installed yet.
              </div>
            )}
          </div>
        </section>

        <section className="ui-card p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              Install Plugin
            </h2>
            <p className="text-sm text-text-muted">
              Upload a packaged plugin bundle JSON, or paste the bundle content
              directly for admin-approved installs.
            </p>
          </div>
          <input
            type="file"
            accept=".json"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
          <textarea
            value={bundleText}
            onChange={(event) => setBundleText(event.target.value)}
            rows={16}
            placeholder='Paste plugin bundle JSON here if you are not uploading a file.'
            className="w-full rounded-xl border border-border-default bg-surface-base p-3 text-sm outline-none"
          />
          <button
            onClick={() => void onInstall()}
            disabled={loading || (!selectedFile && !bundleText.trim())}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Working..." : "Install Plugin"}
          </button>
          {message && <div className="text-sm text-success">{message}</div>}
          {error && <div className="text-sm text-error">{error}</div>}
        </section>
      </div>
    </div>
  );
};

export default PluginRegistryPage;
