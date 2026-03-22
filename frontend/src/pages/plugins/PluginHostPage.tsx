import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { usePluginRuntime } from "../../context/PluginRuntimeContext";
import { pluginService } from "../../services/plugin.service";
import { useAuth } from "../../context/AuthContext";

const PluginHostPage = () => {
  const { pluginKey = "", pageKey } = useParams();
  const { installs } = usePluginRuntime();
  const { hasPermission } = useAuth();
  const [pageData, setPageData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);

  const plugin = useMemo(
    () => installs.find((item) => item.pluginKey === pluginKey),
    [installs, pluginKey],
  );

  const page = useMemo(() => {
    if (!plugin) return null;
    return (
      plugin.pages.find((item: any) => item.pageKey === pageKey) ??
      plugin.pages[0] ??
      null
    );
  }, [plugin, pageKey]);

  useEffect(() => {
    setPageData(null);
    setReportData(null);
    if (!plugin || !page) return;
    if (page.rendererType === "hostTablePage") {
      void pluginService
        .runPageQuery(plugin.pluginKey, page.pageKey)
        .then(setPageData)
        .catch((error) => console.error(error));
    }
  }, [plugin, page]);

  if (!plugin || !page) {
    return (
      <div className="p-6 text-sm text-text-muted">
        Plugin page not found or not enabled.
      </div>
    );
  }

  if (page.permissionCode && !hasPermission(page.permissionCode)) {
    return (
      <div className="p-6 text-sm text-error">
        You do not have permission to access this plugin page.
      </div>
    );
  }

  const renderPage = () => {
    if (page.rendererType === "hostFormPage") {
      const fields = page.config?.fields ?? [];
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field: any) => (
            <label
              key={field.key}
              className="rounded-xl border border-border-default bg-surface-base p-4"
            >
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {field.label}
              </div>
              <input
                disabled
                value={field.defaultValue ?? ""}
                className="w-full rounded-lg border border-border-subtle bg-surface-card px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
      );
    }

    if (page.rendererType === "hostTablePage") {
      const columns = pageData?.columns ?? page.config?.columns ?? [];
      const rows = pageData?.rows ?? [];
      return (
        <div className="overflow-x-auto rounded-xl border border-border-default">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-raised">
              <tr>
                {columns.map((column: any) => (
                  <th key={column.key} className="px-3 py-2 text-left font-semibold">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, index: number) => (
                <tr key={index} className="border-t border-border-subtle">
                  {columns.map((column: any) => (
                    <td key={column.key} className="px-3 py-2">
                      {String(row[column.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td
                    colSpan={Math.max(columns.length, 1)}
                    className="px-3 py-6 text-center text-text-muted"
                  >
                    No rows returned.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
    }

    if (page.rendererType === "hostDashboardWidget") {
      const widgets = plugin.widgets ?? [];
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {widgets.map((widget: any) => (
            <div
              key={widget.widgetKey}
              className="rounded-xl border border-border-default bg-surface-base p-4"
            >
              <div className="text-sm font-semibold text-text-primary">
                {widget.title}
              </div>
              <div className="mt-2 text-xs text-text-muted">
                {widget.widgetType}
              </div>
              {widget.config?.summary && (
                <div className="mt-3 text-sm text-text-secondary">
                  {widget.config.summary}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (page.rendererType === "hostReportAction") {
      const reportKey = page.config?.reportKey;
      return (
        <div className="space-y-4">
          <button
            onClick={() =>
              void pluginService
                .runReport(plugin.pluginKey, reportKey)
                .then(setReportData)
            }
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Run Report
          </button>
          {reportData && (
            <div className="overflow-x-auto rounded-xl border border-border-default">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-raised">
                  <tr>
                    {(reportData.columns ?? []).map((column: any) => (
                      <th key={column.key} className="px-3 py-2 text-left font-semibold">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(reportData.rows ?? []).map((row: any, index: number) => (
                    <tr key={index} className="border-t border-border-subtle">
                      {(reportData.columns ?? []).map((column: any) => (
                        <td key={column.key} className="px-3 py-2">
                          {String(row[column.key] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    if (page.rendererType === "remoteUiPage") {
      const remoteUrl = page.config?.remoteUrl;
      return remoteUrl ? (
        <iframe
          title={page.title}
          src={remoteUrl}
          className="h-[70vh] w-full rounded-xl border border-border-default bg-white"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border-default p-6 text-sm text-text-muted">
          Remote UI page is declared, but no remote URL is configured.
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-dashed border-border-default p-6 text-sm text-text-muted">
        Unsupported page renderer.
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <div className="text-xs uppercase tracking-widest text-text-muted">
          Plugin
        </div>
        <h1 className="text-2xl font-semibold text-text-primary">
          {plugin.plugin.name}
        </h1>
        <p className="text-sm text-text-muted">
          {plugin.plugin.description ?? plugin.pluginKey}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {plugin.pages.map((item: any) => (
          <div
            key={item.pageKey}
            className={`rounded-full border px-3 py-1 text-xs ${item.pageKey === page.pageKey ? "border-primary text-primary" : "border-border-default text-text-muted"}`}
          >
            {item.title}
          </div>
        ))}
      </div>

      {renderPage()}
    </div>
  );
};

export default PluginHostPage;
